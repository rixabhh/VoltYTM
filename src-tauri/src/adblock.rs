use serde::Serialize;
use thiserror::Error;
use ts_rs::TS;
use url::Url;

#[derive(Debug, Error)]
pub enum AdblockError {
    #[error("invalid URL: {0}")]
    InvalidUrl(#[from] url::ParseError),
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub enum BlockReason {
    AdServingHost,
    TrackingHost,
    AdPath,
    TelemetryPath,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", tag = "action", content = "reason")]
pub enum NetworkDecision {
    Allow,
    Block(BlockReason),
}

const AD_HOST_FRAGMENTS: &[&str] = &[
    "doubleclick.net",
    "googleadservices.com",
    "googlesyndication.com",
    "pagead2.googlesyndication.com",
    "youtube.com/pagead",
    "youtube.com/ptracking",
];

const TRACKING_HOST_FRAGMENTS: &[&str] = &[
    "google-analytics.com",
    "googletagmanager.com",
    "stats.g.doubleclick.net",
];

const AD_PATH_FRAGMENTS: &[&str] = &[
    "/api/stats/ads",
    "/get_midroll_info",
    "/pagead/",
    "/ptracking",
    "/youtubei/v1/log_interaction",
];

const TELEMETRY_PATH_FRAGMENTS: &[&str] = &[
    "/api/stats/qoe",
    "/api/stats/watchtime",
    "/generate_204",
    "/youtubei/v1/log_event",
];

pub fn classify_url(raw_url: &str) -> Result<NetworkDecision, AdblockError> {
    let url = Url::parse(raw_url)?;
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    let path = url.path().to_ascii_lowercase();

    if AD_HOST_FRAGMENTS.iter().any(|fragment| host.contains(fragment)) {
        return Ok(NetworkDecision::Block(BlockReason::AdServingHost));
    }

    if TRACKING_HOST_FRAGMENTS
        .iter()
        .any(|fragment| host.contains(fragment))
    {
        return Ok(NetworkDecision::Block(BlockReason::TrackingHost));
    }

    if AD_PATH_FRAGMENTS
        .iter()
        .any(|fragment| path.contains(fragment))
    {
        return Ok(NetworkDecision::Block(BlockReason::AdPath));
    }

    if TELEMETRY_PATH_FRAGMENTS
        .iter()
        .any(|fragment| path.contains(fragment))
    {
        return Ok(NetworkDecision::Block(BlockReason::TelemetryPath));
    }

    Ok(NetworkDecision::Allow)
}

#[cfg(test)]
mod tests {
    use super::{classify_url, BlockReason, NetworkDecision};

    #[test]
    fn allows_music_streams() {
        let decision = classify_url("https://rr2---sn-q4flrney.googlevideo.com/videoplayback")
            .expect("valid stream URL");

        assert_eq!(decision, NetworkDecision::Allow);
    }

    #[test]
    fn blocks_ad_hosts() {
        let decision =
            classify_url("https://securepubads.g.doubleclick.net/gampad/ads").expect("valid URL");

        assert_eq!(decision, NetworkDecision::Block(BlockReason::AdServingHost));
    }

    #[test]
    fn blocks_youtube_ad_paths() {
        let decision = classify_url("https://music.youtube.com/api/stats/ads?ver=2")
            .expect("valid URL");

        assert_eq!(decision, NetworkDecision::Block(BlockReason::AdPath));
    }
}
