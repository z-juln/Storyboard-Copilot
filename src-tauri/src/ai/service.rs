use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::ai::adapters;
use crate::ai::dto::{
    BuiltinAdapterSummaryDto, InvokeModelAdapterRequestDto, ModelCallResultDto,
    PollModelAdapterRequestDto, ProviderSecretStatusDto,
};
use crate::ai::error::AIError;
use crate::ai::secrets;

pub struct AiService {
    db_path: PathBuf,
}

impl AiService {
    pub fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }

    pub fn db_path(&self) -> &Path {
        &self.db_path
    }

    pub fn list_adapters(&self) -> Vec<BuiltinAdapterSummaryDto> {
        adapters::list_builtin_adapters()
    }

    pub async fn invoke_adapter(
        &self,
        request: InvokeModelAdapterRequestDto,
    ) -> Result<ModelCallResultDto, AIError> {
        adapters::invoke_adapter(
            &self.db_path,
            &request.adapter_id,
            request.input,
            request.params,
        )
        .await
    }

    pub async fn poll_adapter(
        &self,
        request: PollModelAdapterRequestDto,
    ) -> Result<ModelCallResultDto, AIError> {
        adapters::poll_adapter(&self.db_path, &request.adapter_id, request.task).await
    }

    pub fn secret_status(&self, provider_id: &str) -> Result<ProviderSecretStatusDto, String> {
        let conn = secrets::open_secrets_db(&self.db_path)?;
        Ok(secrets::secret_status(&conn, provider_id))
    }

    pub fn set_provider_secret(&self, provider_id: &str, api_key: &str) -> Result<(), String> {
        let conn = secrets::open_secrets_db(&self.db_path)?;
        secrets::set_provider_secret(&conn, provider_id, api_key, now_ms())
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
