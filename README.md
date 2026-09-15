**English** | [简体中文](README.zh-CN.md)

# dsh-offpeak-queue

An off-peak delivery queue for DeepSeek Harness (DSH). Keep the native composer for normal messages, switch to **Send off-peak** when a request can wait, and let the plugin deliver it to the original conversation after the peak window for **that conversation's provider** ends. Provider schedules come from the `dsh-offpeak` plugin; without it the queue falls back to its own local windows.

Tested with DSH Desktop 2.0.3 on Windows using the `desktop` profile.

## Features

- **Direct send by default** — the stock DSH composer behaves normally until you opt in.
- **Peak-hour interception** — while **Send off-peak** is active, Enter and the native send button queue the current message during peak hours.
- **Provider-aware scheduling** — every queued item remembers its session's provider/model, so DeepSeek items wait for DeepSeek off-peak hours and Z.ai items wait for Z.ai off-peak hours.
- **Native multiline editing** — Shift+Enter continues to insert a newline.
- **Automatic delivery** — queued messages are sent to their original conversations when off-peak time begins.
- **Centered queue panel** — inspect waiting, in-progress, and recent items without being constrained by the composer area.
- **Queue controls** — force immediate delivery, revoke an item, or clear the history.
- **Configurable policy** — edit peak windows, weekend behavior, concurrency, and the global enabled state.
- **Defensive isolation** — host and client errors are logged and contained so the plugin cannot intentionally take down DSH startup or rendering.
- **Theme-aware UI** — compact cards and pills adapt to the current DSH theme.

## How sending is decided

| Plugin | Mode | Current period | Result |
| --- | --- | --- | --- |
| Disabled | Any | Any | DSH sends normally |
| Enabled | Direct send | Any | DSH sends normally |
| Enabled | Send off-peak | Off-peak | DSH sends normally |
| Enabled | Send off-peak | Peak | The message is queued |

### Provider schedules

When `dsh-offpeak` is mounted, the queue asks it for the active session's provider/model window on every send and delivery decision:

- a DeepSeek conversation queues only during DeepSeek's peak windows;
- a Z.ai conversation queues only during Z.ai's peak windows;
- a flat-rate provider never queues.

Every queued item keeps the provider and model captured at enqueue time, so items for different providers wait independently and are delivered as each provider reaches its own off-peak window.

### Fallback windows

Without `dsh-offpeak`, or for a provider whose schedule is not configured there, the queue falls back to its own local-time windows, editable from the queue panel:

- Peak windows: `09:00–12:00` and `14:00–18:00`
- Saturday and Sunday: treated as off-peak
- Delivery concurrency: `1`
- Mode: Direct send

Overnight ranges such as `22:00–06:00` are supported.

## Requirements

- DeepSeek Harness with a Web or Desktop profile
- DSH runtime `>=0.1.5-rc.1`
- Node.js 22.19 or newer
- `dsh-offpeak` `>=0.2.0` mounted in the same profile for provider-aware scheduling (optional; without it the queue falls back to local windows)
- A full DSH restart after installation or upgrade, because static client bundles are loaded at startup

## Installation

### From npm

For provider-aware scheduling, install and mount [dsh-offpeak](https://github.com/AlexShang1992/dsh-offpeak) first. The queue reads its `offpeak` settings namespace and host service.

The package-name commands below become available after `dsh-offpeak-queue` is published to npm.

For DSH Desktop:

```powershell
dsh plugin --profile desktop add dsh-offpeak-queue
```

For the standard Web profile:

```powershell
dsh plugin --profile web add dsh-offpeak-queue
```

Restart DSH Desktop or the corresponding DSH profile after installation.

### Local development link

```powershell
dsh plugin --profile desktop add "link:E:/path/to/dsh-offpeak-queue"
```

The package is a native static host/client bundle. Keep it registered in `dsh.profile.bundles`; do not replace it with a runtime `define` bootstrap.

### Update or remove

```powershell
dsh plugin --profile desktop update dsh-offpeak-queue
dsh plugin --profile desktop remove dsh-offpeak-queue
```

Replace `desktop` with the profile you actually use, then restart that profile.

## Usage

1. Open a DSH conversation. The plugin shows **Direct send** and **Queue n** near the composer.
2. Click **Direct send** to switch to **Send off-peak**.
3. During the current provider's peak window, compose a message and press Enter or click DSH's send button. The plugin queues the message and clears the composer only after the host confirms it was accepted.
4. Click **Queue n** to inspect or manage queued work.
5. At off-peak time, the host delivers each item to the conversation in which it was created.

If the current conversation cannot be identified, the plugin blocks the intercepted send and reports the problem instead of risking delivery to the wrong conversation.

## Storage, privacy, and limits

Configuration and diagnostics are kept under:

```text
%DSH_HOME%\offpeak-queue\
├── config.json
└── host.log
```

- The plugin does not need an external network service or separate credentials.
- Client diagnostics are posted only to the plugin's local DSH host route and appended to `host.log`.
- Configuration is persisted in `config.json`.
- Waiting, in-progress, and history entries currently live in memory. They are cleared when the DSH host process exits. Resolve or copy pending messages before restarting DSH.
- The queue accepts up to 200 pending items and each message is limited to 50,000 characters.
- Provider and model ids are captured from the live session when the message is queued; they are used only to look up that provider's schedule.
- Failed deliveries are retried up to three times, with a short cooldown between attempts.

## Troubleshooting

### The controls do not appear

Static client modules are scanned at startup. Fully quit and restart DSH, then inspect:

```text
%DSH_HOME%\offpeak-queue\host.log
```

The log should show host boot, route registration, client boot, and a successful DOM probe or native fallback mount.

### Emergency disable

If the plugin ever prevents a profile from starting, add this entry at the top-level array of that profile's `cordis.patch.yml`, then restart DSH:

```yaml
- id: offpeak-queue
  name: dsh-offpeak-queue
  disabled: true
```

Remove the entry and restart again to re-enable the plugin. Uninstallation is not required.

## Architecture

```text
dsh-offpeak-queue
├── index.js             Host half: routes, configuration, scheduler, delivery
├── client.js            Static client half: controls, modal, send interception
├── src/core.mjs         Framework-independent queue state machine
├── cordis.patch.yml     Native DSH profile bundle row
├── scripts/             Smoke and structural balance checks
└── test/                Core behavior tests
```

The browser side communicates with the host through local `/dsh-offpeak-queue/*` routes. The host resumes the recorded DSH session and submits the queued text through the session's normal follow-up path.

## Development

Run the full verification suite before packaging:

```powershell
npm run verify
npm pack --dry-run
```

The expanded commands are:

```powershell
node --check client.js
node --check index.js
node --test test/core.test.mjs
node scripts/smoke.mjs
node scripts/balance.mjs
```

## Publishing

Before the first public release, confirm that the npm package name is still available. Then verify the tarball, publish it to npm, tag the same version on GitHub, and attach the generated `.tgz` to the GitHub Release.

For ecosystem discovery, add the `dsh-plugin` topic to the GitHub repository. Community catalogs can then discover the npm package by its existing `dsh-plugin` and `deepseek-harness` keywords; the DSH Web community index additionally accepts a pull request that adds the repository and npm coordinates to its `community.json`.

## License

MIT. See [LICENSE](LICENSE).
