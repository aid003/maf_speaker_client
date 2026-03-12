# Voice Protocol (Frontend -> Backend)

## Transport

- Канал: `WebSocket` (`NEXT_PUBLIC_WS_URL`)
- Формат control-сообщений: JSON text frames
- Формат аудио: binary frames
- Кодировка аудио: `Float32 PCM LE`, `48000 Hz`, `mono`

## Session lifecycle

1. Клиент открывает WebSocket.
2. На `open` отправляет `session.start`.
3. После запуска микрофона постоянно отправляет `audio.chunk` как binary frame.
4. После завершения озвучки ответа отправляет `playback.finished`.

## Client JSON events

### `session.start`

```json
{
  "type": "session.start",
  "device_id": "robot-01",
  "audio_format": "f32le",
  "sample_rate": 48000,
  "channels": 1
}
```

### `playback.finished`

```json
{
  "type": "playback.finished"
}
```

### `debug.ping` (optional)

```json
{
  "type": "debug.ping",
  "sent_at": 1710000000000
}
```

Используется только для диагностики RTT в тех-модалке.

## Binary audio frame format

Каждый отправляемый аудиофрейм:

- Header: 8 bytes (little-endian)
  - `uint32` `seq` (offset 0)
  - `uint16` `sample_count` (offset 4)
  - `uint16` `reserved` (offset 6, сейчас `0`)
- Payload:
  - `sample_count` значений `float32`, mono

Итоговый размер кадра:

`8 + (sample_count * 4)` bytes

## Server events, которые использует frontend

- `wake.detected`
- `speech.started`
- `speech.ended`
- `assistant.processing`
- `assistant.transcript`
- `assistant.text`
- `assistant.audio`
- `error`
- `debug.pong` (optional)

## Mapping events -> UI state

- `wake.detected` -> `armed`
- `speech.started` -> `recording`
- `speech.ended` -> `processing`
- `assistant.processing` -> `processing`
- Binary audio playback start -> `speaking`
- Playback end -> `idle`
- `error` -> `error`
