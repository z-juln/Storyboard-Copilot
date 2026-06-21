import json
import os
import tempfile
import threading
import uuid
from pathlib import Path
from typing import cast

import gradio as gr
import torch
from diffusers.pipelines.z_image.pipeline_output import ZImagePipelineOutput
from diffusers.pipelines.z_image.pipeline_z_image import ZImagePipeline

ROOT = Path(__file__).resolve().parent
MODEL_ID = os.environ.get("ZIMAGE_MODEL_ID", "Tongyi-MAI/Z-Image-Turbo")
PORT = int(os.environ.get("ZIMAGE_PORT", "7860"))
HOST = os.environ.get("ZIMAGE_HOST", "127.0.0.1")
ALLOWED_SIZES = {512, 768, 1024}
DEFAULT_SIZE = int(os.environ.get("ZIMAGE_DEFAULT_SIZE", "768"))
MODEL_STATUS_PATH = ROOT / "model-status.json"
GENERATE_JOBS_PATH = ROOT / "generate-jobs.json"

PIPE = None
LOAD_LOCK = threading.Lock()
LOAD_THREAD = None
JOBS_LOCK = threading.Lock()


def write_model_status(
    *,
    loaded: bool = False,
    loading: bool = False,
    phase: str = "",
    progress: float = 0.0,
    error: str | None = None,
) -> None:
    payload = {
        "loaded": loaded,
        "loading": loading,
        "phase": phase,
        "progress": max(0.0, min(100.0, float(progress))),
        "error": error,
    }
    MODEL_STATUS_PATH.write_text(
        json.dumps(payload, ensure_ascii=False),
        encoding="utf-8",
    )


def read_model_status_dict() -> dict:
    try:
        if MODEL_STATUS_PATH.is_file():
            data = json.loads(MODEL_STATUS_PATH.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
    except (OSError, json.JSONDecodeError, TypeError):
        pass
    return {
        "loaded": PIPE is not None,
        "loading": False,
        "phase": "",
        "progress": 100.0 if PIPE is not None else 0.0,
        "error": None,
    }


def read_generate_jobs() -> dict:
    try:
        if GENERATE_JOBS_PATH.is_file():
            data = json.loads(GENERATE_JOBS_PATH.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
    except (OSError, json.JSONDecodeError, TypeError):
        pass
    return {}


def write_generate_jobs(jobs: dict) -> None:
    GENERATE_JOBS_PATH.write_text(
        json.dumps(jobs, ensure_ascii=False),
        encoding="utf-8",
    )


def update_generate_job(job_id: str, **fields) -> None:
    with JOBS_LOCK:
        jobs = read_generate_jobs()
        current = jobs.get(job_id, {})
        if not isinstance(current, dict):
            current = {}
        current.update(fields)
        jobs[job_id] = current
        write_generate_jobs(jobs)


def resolve_device_and_dtype():
    if torch.cuda.is_available():
        if torch.cuda.is_bf16_supported():
            return "cuda", torch.bfloat16
        return "cuda", torch.float32
    if torch.backends.mps.is_available():
        return "mps", torch.bfloat16
    return "cpu", torch.float32


def normalize_size(raw_size) -> int:
    try:
        size = int(raw_size)
    except (TypeError, ValueError):
        size = DEFAULT_SIZE
    if size not in ALLOWED_SIZES:
        return DEFAULT_SIZE
    return size


def load_pipeline():
    global PIPE
    with LOAD_LOCK:
        if PIPE is not None:
            write_model_status(
                loaded=True,
                loading=False,
                phase="模型已就绪",
                progress=100.0,
            )
            return PIPE

        write_model_status(loading=True, phase="初始化设备", progress=5.0)
        device, dtype = resolve_device_and_dtype()
        local_only = os.environ.get("ZIMAGE_LOCAL_FILES_ONLY", "1") == "1"

        write_model_status(loading=True, phase="加载模型权重（首次约 2–5 分钟）", progress=20.0)
        try:
            PIPE = ZImagePipeline.from_pretrained(
                MODEL_ID,
                torch_dtype=dtype,
                low_cpu_mem_usage=True,
                local_files_only=local_only,
            )
            write_model_status(loading=True, phase="迁移模型至 GPU", progress=85.0)
            PIPE.to(device)
            if hasattr(PIPE, "enable_attention_slicing"):
                PIPE.enable_attention_slicing()
        except Exception as exc:
            PIPE = None
            write_model_status(
                loaded=False,
                loading=False,
                phase="模型加载失败",
                progress=0.0,
                error=str(exc),
            )
            raise

        write_model_status(
            loaded=True,
            loading=False,
            phase="模型已就绪",
            progress=100.0,
        )
        return PIPE


def _warmup_worker() -> None:
    try:
        load_pipeline()
    except Exception:
        return


def start_warmup_if_needed() -> str:
    global LOAD_THREAD
    if PIPE is not None:
        return "already_ready"

    status = read_model_status_dict()
    if status.get("loading"):
        return "loading"

    with LOAD_LOCK:
        if PIPE is not None:
            return "already_ready"
        if LOAD_THREAD is not None and LOAD_THREAD.is_alive():
            return "loading"
        write_model_status(loading=True, phase="准备加载模型", progress=1.0)
        LOAD_THREAD = threading.Thread(target=_warmup_worker, daemon=True)
        LOAD_THREAD.start()
        return "started"


def warmup_model():
    return start_warmup_if_needed()


def get_model_status():
    status = read_model_status_dict()
    return [
        bool(status.get("loaded")),
        bool(status.get("loading")),
        str(status.get("phase") or ""),
        float(status.get("progress") or 0.0),
        status.get("error"),
    ]


def _run_generate(prompt: str, size: str) -> str:
    cleaned = (prompt or "").strip()
    if not cleaned:
        raise ValueError("请输入提示词")
    side = normalize_size(size)
    pipe = load_pipeline()
    with torch.inference_mode():
        write_model_status(loaded=True, loading=False, phase="正在生成图片", progress=100.0)
        result = cast(
            ZImagePipelineOutput,
            pipe(
                prompt=cleaned,
                height=side,
                width=side,
                num_inference_steps=9,
                guidance_scale=0.0,
            ),
        )
    image = result.images[0]
    output_dir = ROOT / "outputs"
    output_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        suffix=".png",
        prefix="zimage-",
        dir=output_dir,
        delete=False,
    ) as handle:
        path = Path(handle.name)
    image.save(path)
    write_model_status(
        loaded=True,
        loading=False,
        phase="模型已就绪",
        progress=100.0,
    )
    return str(path)


def _generate_worker(job_id: str, prompt: str, size: str) -> None:
    try:
        update_generate_job(
            job_id,
            status="running",
            phase="准备生成",
            progress=15.0,
            error=None,
        )
        update_generate_job(job_id, phase="正在生成图片", progress=45.0)
        path = _run_generate(prompt, size)
        update_generate_job(
            job_id,
            status="succeeded",
            phase="完成",
            progress=100.0,
            result_path=path,
            error=None,
        )
    except Exception as exc:
        update_generate_job(
            job_id,
            status="failed",
            phase="生成失败",
            progress=0.0,
            error=str(exc),
        )


def submit_generate_job(job_id: str, prompt: str, size: str = str(DEFAULT_SIZE)):
    cleaned_job_id = (job_id or "").strip()
    if not cleaned_job_id:
        cleaned_job_id = str(uuid.uuid4())

    cleaned_prompt = (prompt or "").strip()
    if not cleaned_prompt:
        raise gr.Error("请输入提示词")

    normalized_size = str(normalize_size(size))

    with JOBS_LOCK:
        jobs = read_generate_jobs()
        existing = jobs.get(cleaned_job_id)
        if isinstance(existing, dict) and existing.get("status") in ("queued", "running"):
            return cleaned_job_id
        jobs[cleaned_job_id] = {
            "status": "queued",
            "phase": "排队中",
            "progress": 0.0,
            "prompt": cleaned_prompt,
            "size": normalized_size,
            "result_path": None,
            "error": None,
        }
        write_generate_jobs(jobs)

    worker = threading.Thread(
        target=_generate_worker,
        args=(cleaned_job_id, cleaned_prompt, normalized_size),
        daemon=True,
    )
    worker.start()
    return cleaned_job_id


def get_generate_job(job_id: str):
    cleaned_job_id = (job_id or "").strip()
    if not cleaned_job_id:
        return {
            "status": "not_found",
            "progress": 0.0,
            "phase": "",
            "result_path": "",
            "error": "缺少 job_id",
        }

    job = read_generate_jobs().get(cleaned_job_id)
    if not isinstance(job, dict):
        return {
            "status": "not_found",
            "progress": 0.0,
            "phase": "",
            "result_path": "",
            "error": "job not found",
        }

    error_value = job.get("error")
    return {
        "status": str(job.get("status") or "unknown"),
        "progress": float(job.get("progress") or 0.0),
        "phase": str(job.get("phase") or ""),
        "result_path": str(job.get("result_path") or ""),
        "error": "" if error_value is None else str(error_value),
    }


def generate(prompt: str, size: str = str(DEFAULT_SIZE)):
    try:
        return _run_generate(prompt, size)
    except ValueError as exc:
        raise gr.Error(str(exc)) from exc


write_model_status(loaded=False, loading=False, phase="等待加载模型", progress=0.0)

with gr.Blocks(title="Z-Image Local") as demo:
    gr.Markdown("# Z-Image 本地服务")
    prompt = gr.Textbox(label="提示词", lines=3)
    size = gr.Dropdown(
        label="尺寸",
        choices=[str(value) for value in sorted(ALLOWED_SIZES)],
        value=str(DEFAULT_SIZE),
    )
    button = gr.Button("生成", variant="primary")
    output = gr.Image(label="结果", type="filepath")
    button.click(generate, inputs=[prompt, size], outputs=[output], api_name="generate")

    job_id_input = gr.Textbox(visible=False)
    job_prompt_input = gr.Textbox(visible=False)
    job_size_input = gr.Textbox(visible=False)
    job_id_output = gr.Textbox(visible=False)
    submit_job_btn = gr.Button(visible=False)
    submit_job_btn.click(
        submit_generate_job,
        inputs=[job_id_input, job_prompt_input, job_size_input],
        outputs=[job_id_output],
        api_name="submit_generate_job",
    )

    query_job_id_input = gr.Textbox(visible=False)
    query_job_output = gr.JSON(visible=False)
    query_job_btn = gr.Button(visible=False)
    query_job_btn.click(
        get_generate_job,
        inputs=[query_job_id_input],
        outputs=[query_job_output],
        api_name="get_generate_job",
    )

    warmup_btn = gr.Button("预加载模型", visible=False)
    warmup_btn.click(warmup_model, None, None, api_name="warmup_model")
    status_btn = gr.Button("读取模型状态", visible=False)
    status_btn.click(get_model_status, None, None, api_name="get_model_status")

if __name__ == "__main__":
    if os.environ.get("ZIMAGE_WARMUP_ON_START", "1") == "1":
        start_warmup_if_needed()
    demo.launch(server_name=HOST, server_port=PORT)
