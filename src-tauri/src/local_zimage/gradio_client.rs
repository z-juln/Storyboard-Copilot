use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

const REQUEST_TIMEOUT_SECS: u64 = 30;
const GENERATE_SSE_TIMEOUT_SECS: u64 = 600;

pub async fn supports_job_api(base_url: &str) -> bool {
    let client = Client::new();
    let response = match client
        .get(format!("{base_url}/gradio_api/info"))
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => response,
        _ => return false,
    };

    let body: Value = match response.json().await {
        Ok(body) => body,
        Err(_) => return false,
    };

    body.get("named_endpoints")
        .and_then(|value| value.as_object())
        .map(|endpoints| {
            endpoints.contains_key("/submit_generate_job")
                && endpoints.contains_key("/get_generate_job")
        })
        .unwrap_or(false)
}

pub async fn probe_server(base_url: &str) -> bool {
    let client = Client::new();
    for path in ["/gradio_api/info", "/"] {
        if client
            .get(format!("{base_url}{path}"))
            .timeout(std::time::Duration::from_secs(3))
            .send()
            .await
            .map(|response| response.status().is_success())
            .unwrap_or(false)
        {
            return true;
        }
    }
    false
}

fn gradio_api(base_url: &str, path: &str) -> String {
    format!("{base_url}/gradio_api{path}")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonGenerateJobStatus {
    pub status: String,
    pub progress: f32,
    pub phase: String,
    pub result_path: String,
    pub error: Option<String>,
}

pub async fn submit_python_generate_job(
    base_url: &str,
    job_id: &str,
    prompt: &str,
    size: u32,
) -> Result<(), String> {
    let size_str = normalize_size(size).to_string();
    let result = call_gradio_api(
        base_url,
        "submit_generate_job",
        &[Value::String(job_id.to_string()), Value::String(prompt.to_string()), Value::String(size_str)],
        REQUEST_TIMEOUT_SECS,
    )
    .await?;

    match result {
        Value::String(returned_id) if !returned_id.trim().is_empty() => Ok(()),
        Value::Array(items) if items.first().and_then(|v| v.as_str()).is_some() => Ok(()),
        other => Err(format!("submit_generate_job 返回异常: {other}")),
    }
}

pub async fn poll_python_generate_job(
    base_url: &str,
    job_id: &str,
) -> Result<PythonGenerateJobStatus, String> {
    let result = call_gradio_api(
        base_url,
        "get_generate_job",
        &[Value::String(job_id.to_string())],
        REQUEST_TIMEOUT_SECS,
    )
    .await?;

    parse_python_job_status(&result)
}

fn parse_python_job_status(value: &Value) -> Result<PythonGenerateJobStatus, String> {
    if let Some(obj) = value.as_object() {
        let status = obj
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .trim()
            .to_string();
        let progress = obj
            .get("progress")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0) as f32;
        let phase = obj
            .get("phase")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let result_path = obj
            .get("result_path")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let error_raw = obj
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        return Ok(PythonGenerateJobStatus {
            status,
            progress,
            phase,
            result_path,
            error: if error_raw.is_empty() {
                None
            } else {
                Some(error_raw)
            },
        });
    }

    let items = value
        .as_array()
        .ok_or_else(|| format!("get_generate_job 返回格式异常: {value}"))?;

    if items.len() == 1 {
        if let Some(nested) = items.first().and_then(|item| item.as_object()) {
            return parse_python_job_status(&Value::Object(nested.clone()));
        }
    }

    if items.is_empty() {
        return Err("get_generate_job 返回空数据，请重启 Z-Image 服务以加载最新 app.py".to_string());
    }

    if items.len() < 5 {
        return Err(format!("get_generate_job 返回字段不足: {value}"));
    }

    let status = items[0]
        .as_str()
        .unwrap_or("unknown")
        .trim()
        .to_string();
    let progress = items[1]
        .as_f64()
        .or_else(|| items[1].as_str().and_then(|v| v.parse().ok()))
        .unwrap_or(0.0) as f32;
    let phase = items[2].as_str().unwrap_or("").to_string();
    let result_path = items[3].as_str().unwrap_or("").to_string();
    let error_raw = items[4].as_str().unwrap_or("").trim().to_string();
    let error = if error_raw.is_empty() {
        None
    } else {
        Some(error_raw)
    };

    Ok(PythonGenerateJobStatus {
        status,
        progress,
        phase,
        result_path,
        error,
    })
}

pub async fn call_gradio_api(
    base_url: &str,
    api_name: &str,
    data: &[Value],
    sse_timeout_secs: u64,
) -> Result<Value, String> {
    let client = Client::new();
    let submit_url = gradio_api(base_url, &format!("/call/{api_name}"));
    let response = client
        .post(&submit_url)
        .json(&serde_json::json!({ "data": data }))
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .send()
        .await
        .map_err(|err| format!("调用 {api_name} 失败: {err}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        if status.as_u16() == 500 && body.trim() == "Internal Server Error" {
            return Err(format!(
                "调用 {api_name} 失败 ({status})：Z-Image 服务可能仍在运行旧版本，请在插件列表中停止并重新启动 Z-Image 服务"
            ));
        }
        return Err(format!("调用 {api_name} 失败 ({status}): {body}"));
    }

    let submit_body: Value = response
        .json()
        .await
        .map_err(|err| format!("解析 {api_name} 提交响应失败: {err}"))?;
    let event_id = submit_body
        .get("event_id")
        .and_then(|value| value.as_str())
        .ok_or_else(|| format!("{api_name} 未返回 event_id: {submit_body}"))?;

    let result_url = gradio_api(base_url, &format!("/call/{api_name}/{event_id}"));
    let sse_response = client
        .get(&result_url)
        .timeout(std::time::Duration::from_secs(sse_timeout_secs))
        .send()
        .await
        .map_err(|err| format!("读取 {api_name} 结果失败: {err}"))?;

    if !sse_response.status().is_success() {
        let status = sse_response.status();
        let body = sse_response.text().await.unwrap_or_default();
        return Err(format!("读取 {api_name} 结果失败 ({status}): {body}"));
    }

    read_gradio_sse_json(sse_response).await
}

pub async fn call_generate(base_url: &str, prompt: &str, size: u32) -> Result<String, String> {
    let size_str = normalize_size(size).to_string();
    let result = call_gradio_api(
        base_url,
        "generate",
        &[Value::String(prompt.to_string()), Value::String(size_str)],
        GENERATE_SSE_TIMEOUT_SECS,
    )
    .await?;

    extract_image_path(&result)
}

pub async fn call_warmup(base_url: &str) -> Result<(), String> {
    call_gradio_api(base_url, "warmup_model", &[], REQUEST_TIMEOUT_SECS).await?;
    Ok(())
}

async fn read_gradio_sse_json(response: reqwest::Response) -> Result<Value, String> {
    use futures_util::StreamExt;

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut pending_event: Option<String> = None;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|err| format!("读取 Gradio SSE 失败: {err}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim_end_matches('\r').to_string();
            buffer.drain(..=line_end);

            if let Some(value) = process_sse_line(&line, &mut pending_event)? {
                return Ok(value);
            }
        }
    }

    if !buffer.trim().is_empty() {
        for line in buffer.lines() {
            if let Some(value) = process_sse_line(line, &mut pending_event)? {
                return Ok(value);
            }
        }
    }

    Err("Gradio SSE 未返回完整结果".to_string())
}

fn process_sse_line(line: &str, pending_event: &mut Option<String>) -> Result<Option<Value>, String> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with(':') {
        return Ok(None);
    }

    if let Some(event_name) = trimmed.strip_prefix("event:").map(str::trim) {
        *pending_event = Some(event_name.to_string());
        return Ok(None);
    }

    let Some(payload) = trimmed.strip_prefix("data:").map(str::trim) else {
        return Ok(None);
    };

    if payload == "[DONE]" {
        return Ok(None);
    }

    let value: Value = serde_json::from_str(payload)
        .map_err(|err| format!("解析 Gradio SSE 失败: {err} ({payload})"))?;

    if pending_event.as_deref() == Some("complete") {
        *pending_event = None;
        return Ok(Some(value));
    }

    process_legacy_gradio_event(&value)
}

fn process_legacy_gradio_event(event: &Value) -> Result<Option<Value>, String> {
    let msg = event.get("msg").and_then(|v| v.as_str()).unwrap_or("");
    match msg {
        "complete" => {
            if let Some(output) = event.get("output") {
                if let Some(data) = output.get("data") {
                    if let Some(first) = data.as_array().and_then(|items| items.first()) {
                        return Ok(Some(first.clone()));
                    }
                    return Ok(Some(data.clone()));
                }
            }
            if let Some(data) = event.get("data") {
                return Ok(Some(data.clone()));
            }
            Err(format!("Gradio complete 事件缺少 data: {event}"))
        }
        "error" => {
            let detail = event
                .get("output")
                .and_then(|output| output.get("error"))
                .or_else(|| event.get("message"))
                .and_then(|v| v.as_str())
                .unwrap_or("Gradio 处理失败");
            Err(detail.to_string())
        }
        "process_starts" | "process_generating" | "process_completed" => Ok(None),
        _ => Ok(None),
    }
}

fn normalize_size(size: u32) -> u32 {
    match size {
        512 | 768 | 1024 => size,
        _ => 768,
    }
}

fn extract_image_path(value: &Value) -> Result<String, String> {
    match value {
        Value::String(path) if !path.trim().is_empty() => Ok(path.trim().to_string()),
        Value::Object(map) => {
            if let Some(path) = map.get("path").and_then(|v| v.as_str()) {
                return Ok(path.to_string());
            }
            if let Some(url) = map.get("url").and_then(|v| v.as_str()) {
                return Ok(url.to_string());
            }
            Err(format!("无法解析图片路径: {value}"))
        }
        Value::Array(items) => {
            if let Some(first) = items.first() {
                return extract_image_path(first);
            }
            Err(format!("无法解析图片路径: {value}"))
        }
        other => Err(format!("无法解析图片路径: {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_python_job_status, process_legacy_gradio_event, process_sse_line};
    use serde_json::json;

    #[test]
    fn parses_python_job_status() {
        let status = parse_python_job_status(&json!([
            "running",
            45.0,
            "正在生成图片",
            "",
            ""
        ]))
        .expect("should parse");
        assert_eq!(status.status, "running");
        assert_eq!(status.progress, 45.0);
        assert_eq!(status.phase, "正在生成图片");
        assert!(status.error.is_none());
    }

    #[test]
    fn parses_python_job_status_object() {
        let status = parse_python_job_status(&json!({
            "status": "running",
            "progress": 45.0,
            "phase": "正在生成图片",
            "result_path": "",
            "error": ""
        }))
        .expect("should parse");
        assert_eq!(status.status, "running");
    }

    #[test]
    fn parses_gradio6_complete_sse_json() {
        let line = r#"data: {"msg":"complete","output":{"data":["/tmp/zimage.png"]}}"#;
        let mut pending = None;
        let value = process_sse_line(line, &mut pending)
            .expect("parse")
            .expect("should complete");
        assert_eq!(value, json!("/tmp/zimage.png"));
    }

    #[test]
    fn parses_gradio6_multiline_complete_sse() {
        let mut pending = None;
        assert!(process_sse_line("event: complete", &mut pending)
            .expect("parse")
            .is_none());
        let value = process_sse_line("data: []", &mut pending)
            .expect("parse")
            .expect("should complete");
        assert_eq!(value, json!([]));
    }

    #[test]
    fn parses_gradio6_job_status_sse() {
        let mut pending = None;
        process_sse_line("event: complete", &mut pending).expect("parse");
        let value = process_sse_line(
            r#"data: ["running", 45.0, "phase", "", ""]"#,
            &mut pending,
        )
        .expect("parse")
        .expect("should complete");
        assert_eq!(value, json!(["running", 45.0, "phase", "", ""]));
    }

    #[test]
    fn legacy_complete_event_still_works() {
        let event = json!({"msg":"complete","output":{"data":["/tmp/zimage.png"]}});
        let value = process_legacy_gradio_event(&event)
            .expect("parse")
            .expect("should complete");
        assert_eq!(value, json!("/tmp/zimage.png"));
    }
}
