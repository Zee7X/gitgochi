# GitHub Webhook API Specification

## Endpoint
`POST /api/webhook/github`

## Authentication & Headers
- `X-GitHub-Event`: Event name (`push`, `pull_request`, `issues`, `check_run`, `workflow_run`)
- `X-Hub-Signature-256`: HMAC-SHA256 signature payload jika secret dikonfigurasi

## Event Mapping

### 1. `push`
- **Tujuan:** Memberi makan monster (Feed / Fullness).
- **Payload fields:** `commits`, `repository.full_name`, `pusher.name`.
- **Efek:**
  - Fullness += commits.length * 5 (maks 100)
  - Sanity dicek berdasarkan pesan commit (contoh: "fix" menambah sanity +5)

### 2. `check_run` / `workflow_run`
- **Tujuan:** Menentukan HP monster.
- **Payload fields:** `check_run.conclusion` atau `workflow_run.conclusion`.
- **Nilai:**
  - `success`: HP += 15
  - `failure`: HP -= 25
  - Jika HP mencapai 0, trigger status `ZOMBIE_CORPSE`.

### 3. `pull_request`
- **Tujuan:** Peningkatan atribut besar.
- **Action:** `closed` dengan `merged: true`:
  - Fullness += 20
  - HP += 10
  - Efek animasi selebrasi di layar LCD

### 4. `issues`
- **Tujuan:** Mempengaruhi kebersihan dan sanity.
- **Action:**
  - `opened`: Sanity -= 5
  - `closed`: Sanity += 10, jika dalam status ZOMBIE_CORPSE berkontribusi pada kebangkitan (Resurrection Ritual).

## Response Format
```json
{
  "success": true,
  "eventType": "push",
  "petState": {
    "hp": 90,
    "fullness": 85,
    "sanity": 95,
    "stage": "CODE_DEMON"
  }
}
```
