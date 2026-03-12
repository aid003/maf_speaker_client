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

### `assistant.transcript`

```json
{
  "type": "assistant.transcript",
  "text": "какая сегодня погода"
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

После этого события backend отправляет binary frame с аудио-данными для проигрывания.

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

## Frontend -> Backend obligations

- Сразу после подключения отправить `session.start`.
- Передавать бинарные аудиокадры последовательно по `seq`.
- После завершения проигрывания ответа отправить `playback.finished`.
- При наличии диагностики периодически отправлять `debug.ping`.

## UI requirements covered

- Состояния: `idle`, `armed`, `recording`, `processing`, `speaking`, `error`
- Текстовые поля: распознанная реплика и ответ ассистента
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
