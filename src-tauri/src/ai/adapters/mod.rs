pub mod builtin;
pub mod registry;

pub use registry::{
    invoke_adapter, list_builtin_adapters, poll_adapter, BuiltinAdapterDefinition,
};
