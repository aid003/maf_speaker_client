# Frontend/Backend Contract

## Overview

Фронтенд работает как thin voice client:

- захватывает микрофон через WebAudio
- отправляет аудиопоток в backend
- принимает серверные события
- проигрывает аудио-ответ
- показывает состояния и тех-диагностику

## Runtime config

- Переменная окружения: `NEXT_PUBLIC_WS_URL`
- Без токена в первой версии

## Backend -> Frontend JSON events

### `wake.detected`

```json
{ "type": "wake.detected" }
```

### `speech.started`

```json
{ "type": "speech.started" }
```

### `speech.ended`

```json
{ "type": "speech.ended" }
```

### `assistant.processing`

```json
{ "type": "assistant.processing" }
```

### `assistant.partial_transcript` (streaming, optional)

Черновая расшифровка речи пользователя, может приходить многократно за одну реплику.

```json
{
  "type": "assistant.partial_transcript",
  "content": "привет, как д",
  "final": false
}
```

Последнее сообщение может быть либо `assistant.transcript`, либо `assistant.partial_transcript` с `"final": true`.

### `assistant.transcript`

```json
{
  "type": "assistant.transcript",
  "text": "какая сегодня погода"
}
```

### `assistant.partial_text` (streaming, optional)

Частичный ответ ассистента от LLM по мере генерации.

```json
{
  "type": "assistant.partial_text",
  "content": "Сейчас расскажу, как устроена",
  "final": false
}
```

### `assistant.text`

```json
{
  "type": "assistant.text",
  "text": "Сегодня в Амстердаме..."
}
```

### `assistant.audio` (meta)

```json
{
  "type": "assistant.audio",
  "format": "wav",
  "mime_type": "audio/wav"
}
```

После этого события backend отправляет аудио-данные:

- **Legacy:** один binary frame с полным файлом — фронт проигрывает его целиком и затем шлёт `playback.finished`.
- **Streaming:** несколько binary frames (чанки), затем событие `assistant.audio.end` — фронт добавляет чанки в очередь, воспроизводит по мере поступления и шлёт `playback.finished` после фактического окончания воспроизведения.

### `assistant.audio.end` (streaming, optional)

Сигнал окончания аудио-потока. Фронт завершает текущий поток и после окончания воспроизведения отправляет `playback.finished`.

```json
{
  "type": "assistant.audio.end"
}
```

### `error`

```json
{
  "type": "error",
  "message": "connection lost"
}
```

### `debug.pong` (optional)

```json
{
  "type": "debug.pong",
  "sent_at": 1710000000000,
  "echoed_at": 1710000000041
}
```

## Streaming vs legacy

Фронт поддерживает оба режима без смены конфигурации:

- **Legacy:** backend шлёт `assistant.audio` (meta) и один binary frame — фронт воспроизводит файл целиком и один раз шлёт `playback.finished`.
- **Streaming:** backend шлёт `assistant.audio` (meta), затем несколько binary frames (чанки), затем `assistant.audio.end` — фронт воспроизводит чанки по мере поступления (MediaSource/SourceBuffer) и шлёт `playback.finished` после окончания воспроизведения.

Текстовый стриминг: при приходе `assistant.partial_transcript` и `assistant.partial_text` фронт обновляет черновой текст; при `assistant.transcript` и `assistant.text` — финальный. UI может показывать черновик (например, серым/курсивом) до финала.

## Frontend -> Backend obligations

- Сразу после подключения отправить `session.start`.
- Передавать бинарные аудиокадры последовательно по `seq`.
- После завершения проигрывания ответа отправить один раз `playback.finished`.
- При наличии диагностики периодически отправлять `debug.ping`.

## UI requirements covered

- Состояния: `idle`, `armed`, `recording`, `processing`, `speaking`, `error`
- Текстовые поля: распознанная реплика и ответ ассистента (поддержка partial + final для стриминга)
- Тех-модалка:
  - microphone API
  - permission
  - ws status
  - ui state
  - sample rate
  - seq
  - dropped chunks
  - rtt
  - последние server/client события
