import json
import os
import tempfile
import threading
from pathlib import Path

import gradio as gr
import torch
from diffusers import ZImagePipeline

ROOT = Path(__file__).resolve().parent
MODEL_ID = os.environ.get("ZIMAGE_MODEL_ID", "Tongyi-MAI/Z-Image-Turbo")
PORT = int(os.environ.get("ZIMAGE_PORT", "7860"))
HOST = os.environ.get("ZIMAGE_HOST", "127.0.0.1")
ALLOWED_SIZES = {512, 768, 1024}
DEFAULT_SIZE = int(os.environ.get("ZIMAGE_DEFAULT_SIZE", "768"))
MODEL_STATUS_PATH = ROOT / "model-status.json"

PIPE = None
LOAD_LOCK = threading.Lock()
LOAD_THREAD = None


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
        # load_pipeline already persisted error state
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


def generate(prompt: str, size: str = str(DEFAULT_SIZE)):
    cleaned = (prompt or "").strip()
    if not cleaned:
        raise gr.Error("请输入提示词")
    side = normalize_size(size)
    pipe = load_pipeline()
    with torch.inference_mode():
        write_model_status(loaded=True, loading=False, phase="正在生成图片", progress=100.0)
        result = pipe(
            prompt=cleaned,
            height=side,
            width=side,
            num_inference_steps=9,
            guidance_scale=0.0,
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
    warmup_btn = gr.Button("预加载模型", visible=False)
    warmup_btn.click(warmup_model, None, None, api_name="warmup_model")
    status_btn = gr.Button("读取模型状态", visible=False)
    status_btn.click(get_model_status, None, None, api_name="get_model_status")

if __name__ == "__main__":
    if os.environ.get("ZIMAGE_WARMUP_ON_START", "1") == "1":
        start_warmup_if_needed()
    demo.launch(server_name=HOST, server_port=PORT)
