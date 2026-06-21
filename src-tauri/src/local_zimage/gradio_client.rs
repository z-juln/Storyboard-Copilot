use futures_util::StreamExt;
use serde_json::json;

pub async fn probe_server(base_url: &str) -> bool {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build();
    let Ok(client) = client else {
        return false;
    };
    for path in ["/gradio_api/info", "/"] {
        let ok = client
            .get(format!("{base_url}{path}"))
            .send()
            .await
            .map(|response| response.status().is_success())
            .unwrap_or(false);
        if ok {
            return true;
        }
    }
    false
}

fn gradio_api(base_url: &str, path: &str) -> String {
    format!("{base_url}/gradio_api{path}")
}

pub async fn submit_generate(base_url: &str, prompt: &str, size: u32) -> Result<String, String> {
    let normalized_size = normalize_size(size);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|err| format!("创建 HTTP 客户端失败: {err}"))?;

    let call_response = client
        .post(gradio_api(base_url, "/call/generate"))
        .json(&json!({ "data": [prompt, normalized_size.to_string()] }))
        .send()
        .await
        .map_err(|err| format!("调用 Gradio 失败: {err}"))?;

    if !call_response.status().is_success() {
        return Err(format!(
            "Gradio 返回错误: HTTP {}",
            call_response.status()
        ));
    }

    let payload: serde_json::Value = call_response
        .json()
        .await
        .map_err(|err| format!("解析 Gradio 响应失败: {err}"))?;

    payload
        .get("event_id")
        .and_then(|value| value.as_str())
        .map(str::to_string)
        .ok_or_else(|| "Gradio 未返回 event_id".to_string())
}

pub async fn read_generate_result(base_url: &str, event_id: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(900))
        .build()
        .map_err(|err| format!("创建 HTTP 客户端失败: {err}"))?;

    let result_url = gradio_api(base_url, &format!("/call/generate/{event_id}"));
    let response = client
        .get(&result_url)
        .header("Accept", "text/event-stream")
        .send()
        .await
        .map_err(|err| format!("轮询 Gradio 结果失败: {err}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Gradio 轮询错误: HTTP {}",
            response.status()
        ));
    }

    read_gradio_sse(response).await
}

pub async fn call_generate(base_url: &str, prompt: &str, size: u32) -> Result<String, String> {
    let event_id = submit_generate(base_url, prompt, size).await?;
    read_generate_result(base_url, &event_id).await
}

pub async fn call_warmup(base_url: &str) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|err| format!("创建 HTTP 客户端失败: {err}"))?;

    let call_response = client
        .post(gradio_api(base_url, "/call/warmup_model"))
        .json(&json!({ "data": [] }))
        .send()
        .await
        .map_err(|err| format!("调用模型预加载失败: {err}"))?;

    if !call_response.status().is_success() {
        return Err(format!(
            "模型预加载返回错误: HTTP {}",
            call_response.status()
        ));
    }

    Ok(())
}

fn normalize_size(size: u32) -> u32 {
    match size {
        512 | 768 | 1024 => size,
        _ => 768,
    }
}

async fn read_gradio_sse(response: reqwest::Response) -> Result<String, String> {
    let mut current_event: Option<String> = None;
    let mut line_buffer = String::new();
    let mut raw_body = String::new();
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|err| format!("读取 Gradio 结果失败: {err}"))?;
        let chunk_text = String::from_utf8_lossy(&chunk);
        raw_body.push_str(&chunk_text);
        line_buffer.push_str(&chunk_text);

        while let Some(newline_index) = line_buffer.find('\n') {
            let line = line_buffer[..newline_index]
                .trim_end_matches('\r')
                .to_string();
            line_buffer = line_buffer[newline_index + 1..].to_string();
            if let Some(path) = process_sse_line(&mut current_event, &line)? {
                return Ok(path);
            }
        }
    }

    if !line_buffer.trim().is_empty() {
        if let Some(path) = process_sse_line(&mut current_event, line_buffer.trim())? {
            return Ok(path);
        }
    }

    parse_gradio_result_body(&raw_body)
}

fn process_sse_line(
    current_event: &mut Option<String>,
    line: &str,
) -> Result<Option<String>, String> {
    if line.is_empty() {
        return Ok(None);
    }

    if let Some(event) = line.strip_prefix("event: ") {
        *current_event = Some(event.trim().to_string());
        return Ok(None);
    }

    let Some(data) = line.strip_prefix("data: ") else {
        return Ok(None);
    };
    let data = data.trim();

    match current_event.as_deref() {
        Some("complete") | Some("completed") => {
            let payload: serde_json::Value = serde_json::from_str(data)
                .map_err(|err| format!("解析 Gradio complete 数据失败: {err}"))?;
            Ok(Some(extract_image_path(&payload)?))
        }
        Some("error") => {
            let message = if data.is_empty() || data == "null" {
                "Gradio 生成失败，请确认 Z-Image 服务已重启（设置中停止后再启动）"
                    .to_string()
            } else {
                serde_json::from_str::<String>(data)
                    .unwrap_or_else(|_| data.trim_matches('"').to_string())
            };
            Err(if message.trim().is_empty() {
                "Gradio 生成失败".to_string()
            } else {
                message
            })
        }
        Some("heartbeat") | Some("generating") | None => Ok(None),
        Some(other) => Err(format!("Gradio 返回未知事件: {other}")),
    }
}

fn parse_gradio_result_body(body: &str) -> Result<String, String> {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return Err("Gradio 未返回任何结果".to_string());
    }
    if trimmed.starts_with('{') {
        return parse_gradio_legacy_json(trimmed);
    }

    let mut current_event: Option<String> = None;
    for line in body.lines() {
        if let Some(path) = process_sse_line(&mut current_event, line.trim_end())? {
            return Ok(path);
        }
    }

    Err("Gradio 未返回 complete 事件".to_string())
}

fn parse_gradio_legacy_json(body: &str) -> Result<String, String> {
    let payload: serde_json::Value = serde_json::from_str(body)
        .map_err(|err| format!("解析 Gradio 结果失败: {err}"))?;

    if payload.get("msg").and_then(|v| v.as_str()) == Some("process_completed") {
        return extract_image_path(&payload);
    }

    if let Some(error) = payload.get("error").and_then(|v| v.as_str()) {
        return Err(error.to_string());
    }
    if payload.get("error").map(|v| v.is_null()).unwrap_or(false) {
        return Err(
            "Gradio 生成失败，请确认 Z-Image 服务已重启（设置中停止后再启动）".to_string(),
        );
    }

    Err("Gradio 结果未完成".to_string())
}

fn extract_image_path(payload: &serde_json::Value) -> Result<String, String> {
    if let Some(array) = payload.as_array() {
        if let Some(first) = array.first() {
            return extract_image_path(first);
        }
        return Err("Gradio 输出为空".to_string());
    }

    let output_data = payload
        .pointer("/output/data")
        .or_else(|| payload.get("output"))
        .unwrap_or(payload);

    if let Some(path) = output_data.as_str() {
        return Ok(path.to_string());
    }

    if let Some(array) = output_data.as_array() {
        if let Some(first) = array.first() {
            return extract_image_path(first);
        }
    }

    if let Some(obj_path) = output_data.get("path").and_then(|v| v.as_str()) {
        return Ok(obj_path.to_string());
    }

    if let Some(url) = output_data.get("url").and_then(|v| v.as_str()) {
        return Ok(url.to_string());
    }

    Err(format!("无法解析 Gradio 图片结果: {output_data}"))
}

#[cfg(test)]
mod tests {
    use super::{parse_gradio_result_body, process_sse_line};

    #[test]
    fn parses_gradio6_complete_sse() {
        let body = r#"event: heartbeat
data: null

event: complete
data: [{"path":"/tmp/zimage-test.png","url":"http://127.0.0.1:7860/file=/tmp/zimage-test.png"}]
"#;
        let path = parse_gradio_result_body(body).expect("should parse");
        assert_eq!(path, "/tmp/zimage-test.png");
    }

    #[test]
    fn parses_gradio6_error_sse() {
        let body = r#"event: error
data: "something went wrong"
"#;
        let err = parse_gradio_result_body(body).expect_err("should error");
        assert!(err.contains("something went wrong"));
    }

    #[test]
    fn process_sse_line_returns_complete_early() {
        let mut current_event = Some("complete".to_string());
        let path = process_sse_line(
            &mut current_event,
            r#"data: [{"path":"/tmp/early.png","url":"http://127.0.0.1:7860/file=/tmp/early.png"}]"#,
        )
        .expect("should parse")
        .expect("should return path");
        assert_eq!(path, "/tmp/early.png");
    }
}
