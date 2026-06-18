# KIE 参考图上传

## 为什么需要上传

KIE 的 `createTask` 接口中，参考图字段 `image_input` / `image_urls` **只接受 KIE 云端可访问的 http(s) URL**，不能直接传本地路径或 Base64。

画布里的参考图存在本地，因此需要先把二进制上传到 KIE 临时文件服务，换取公网 URL 后再调用生成接口。若参考图本身已是公网 URL，可跳过上传。

项目实现见 `src-tauri/src/ai/providers/kie/mod.rs`：`upload_reference_image` → `createTask`。

> 上传为**临时文件**，有效期以响应 `data.expiresAt` 为准；项目持久化仍走本地 image pool。

## 端点（项目使用）

```
POST https://kieai.redpandaai.co/api/file-stream-upload
```

### 认证

```
Authorization: Bearer $KIE_API_KEY
Content-Type: multipart/form-data
```

### 请求字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `file` | binary | 图片文件 |
| `uploadPath` | string | 存储路径，项目默认 `images/storyboard-copilot` |
| `fileName` | string | 文件名 |

### cURL 示例

```bash
curl -X POST "https://kieai.redpandaai.co/api/file-stream-upload" \
  -H "Authorization: Bearer $KIE_API_KEY" \
  -F "file=@/path/to/ref.png" \
  -F "uploadPath=images/storyboard-copilot" \
  -F "fileName=ref-1.png"
```

### 响应

成功时返回 JSON，优先取 `data.downloadUrl`，亦可使用 `data.fileUrl`（与项目 `extract_uploaded_file_url` 一致）：

```json
{
  "success": true,
  "code": 200,
  "msg": "File uploaded successfully",
  "data": {
    "downloadUrl": "https://tempfile.redpandaai.co/.../ref-1.png",
    "fileUrl": "https://..."
  }
}
```

## 其他上传方式（可选）

KIE 还提供 Base64、URL 转存等接口，同一 Base URL `https://kieai.redpandaai.co`：

| 端点 | 适用场景 |
|------|----------|
| `/api/file-stream-upload` | 本地文件 / 二进制（**项目采用**） |
| `/api/file-base64-upload` | 小文件 Base64 |
| `/api/file-url-upload` | 从远程 URL 转存到 KIE |

官方文档：[KIE File Upload API](https://docs.kie.ai/cn/file-upload-api/quickstart)

## 与生成接口的关系

```
本地参考图 → file-stream-upload → 临时 https URL
                                      ↓
              createTask (image_input / image_urls: [url, ...]) → taskId
                                      ↓
              recordInfo 轮询 → resultUrls
```

任务查询见 [task-query.md](./task-query.md)。
