use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Command {
    #[serde(rename = "spawn")]
    Spawn {
        command: String,
        args: Vec<String>,
        cwd: String,
        env: Vec<(String, String)>,
        cols: u16,
        rows: u16,
    },
    #[serde(rename = "write")]
    Write { data: String },
    #[serde(rename = "resize")]
    Resize { cols: u16, rows: u16 },
    #[serde(rename = "kill")]
    Kill { signal: Option<String> },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Event {
    #[serde(rename = "ready")]
    Ready { pid: u32 },
    #[serde(rename = "output")]
    Output { data: String },
    #[serde(rename = "render")]
    Render {
        cols: u16,
        rows: u16,
        cells: Vec<CellUpdate>,
    },
    #[serde(rename = "exit")]
    Exit { code: i32, signal: Option<i32> },
    #[serde(rename = "error")]
    Error { message: String },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CellUpdate {
    pub row: u16,
    pub col: u16,
    pub text: String,
    pub fg: Option<String>,
    pub bg: Option<String>,
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
}
