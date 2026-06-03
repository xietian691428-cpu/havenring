# Haven Ring 工厂烧录作业指导书
# Haven Ring — Factory Provisioning SOP (TagXplorer)

**版本 Version:** v1.0 · 2026-06-01  
**客户 Customer:** Haven Ring · https://havenring.me  
**适用设备 Equipment:** NXP **TagXplorer v1.2** + **Identiv uTrust 3700 F** 读卡器  
**芯片 Chip:** **NTAG 424 DNA**（动态 NFC，SDM / SUN）

---

## ⚠️ 保密 / Confidential

本文含生产 **MASTER_KEY**，仅限产线授权人员。禁止拍照外传、上传公网、写入公开文档。  
This document contains the production **MASTER_KEY**. Authorized factory staff only.

---

## 0. 目标 / Objective

每枚戒指出厂后，手机碰戒应打开 **动态 URL**（含 `picc_data` 与 `cmac`），Haven 服务器可验签通过。

After provisioning, each tap must open a **dynamic URL** with `picc_data` and `cmac`, verifiable by Haven servers.

**目标 URL 格式（方案 A）/ Target URL format (Option A):**

```
https://havenring.me/start?picc_data=<动态32位hex>&cmac=<动态16位hex>
```

**禁止 / Do NOT use:** 纯静态 `https://havenring.me/start`（无动态参数）

---

## 1. 环境与软件 / Environment

| 项目 Item | 要求 Requirement |
|-----------|------------------|
| 操作系统 OS | Windows 10/11 或 macOS |
| Java | JRE 8+（TagXplorer 依赖） |
| 软件 Software | **TagXplorer v1.2**（NXP 官网下载） |
| 读卡器 Reader | **Identiv uTrust 3700 F CL Reader**（与截图一致） |
| 芯片 Chip | NTAG 424 DNA |

**启动 TagXplorer：** 双击 `TagXplorer.jar` → 接受 EULA。

---

## 2. 生产密钥 / Production Keys

### 2.1 服务器主密钥（全厂 1 把）/ Server Master Key

```
MASTER_KEY = a53082d97e19a11329ef2e3f7e0d092c
```

- 32 位十六进制，16 字节 AES-128  
- Haven 服务器与烧录密钥 **必须一致**  
- **不要**使用 NXP 出厂默认全零密钥（仅演示用）

### 2.2 每枚戒指 5 个密钥槽 / Five Key Slots Per Ring

TagXplorer **不会**自动从 MASTER_KEY 派生密钥。  
**每枚戒指**须先读取 **UID**，用 Haven 提供的脚本计算 5 个槽位密钥，再手动写入。

TagXplorer does **not** auto-derive keys. Read each tag **UID**, compute keys with Haven script, paste into TagXplorer.

**密钥计算脚本 / Key derivation script**（Haven 提供）:

```bash
python3 derive-ntag424-keys.py a53082d97e19a11329ef2e3f7e0d092c 04:53:A5:3A:50:23:90
```

输出示例 / Example output:

| Card Key No | 用途 Role | 填入 TagXplorer「New Key」 |
|-------------|-----------|---------------------------|
| 00 | Application Master | （脚本 Key0） |
| 01 | SDM Meta Read → `picc_data` | （脚本 Key1，**全厂相同**） |
| 02 | SDM File Read → `cmac` | （脚本 Key2，**每 UID 不同**） |
| 03 | File access | （脚本 Key3） |
| 04 | Counter retrieval | （脚本 Key4） |

> **Key1** 不随 UID 变化；Key0/2/3/4 每枚戒指不同。  
> **Key1** is not UID-diversified; Key0/2/3/4 differ per ring.

---

## 3. 单枚戒指烧录流程 / Per-Ring Workflow

按顺序操作，**不可跳步**。  
Follow steps in order. Do not skip.

---

### 步骤 1 — 连接读卡器与标签  
### Step 1 — Connect Reader and Tag

1. 顶部下拉选择：**Identiv uTrust 3700 F CL Reader 0**  
2. 点击 **Connect Reader**  
3. 戒指平放在读卡器感应区  
4. 点击 **Connect Tag**  
5. 左侧应显示已连接；记录 **IC Type = NTAG 424 DNA**、**Serial Number / UID**

若显示 Disconnected，调整戒指位置后重试。  
If disconnected, reposition the ring and retry.

---

### 步骤 2 — 格式化 NDEF（空白戒指标）  
### Step 2 — Format NDEF (Blank Tags)

1. 切到 **NDEF Operations**  
2. 点击 **Read NDEF**  
3. 若报错或容量为 0 → 点击 **Format NDEF**  
4. 再次 **Read NDEF** 确认无错误

> 已有错误静态 URL 的样品戒，建议先 **Format NDEF** 再烧录。

---

### 步骤 3 — 写入 SDM URL 模板  
### Step 3 — Write SDM URL Template

1. 切到 **NTAG Operations**  
2. 展开 **Mirroring Features** → 选择 **NTAG 424 DNA**  
3. 设置：

| 字段 Field | 值 Value |
|------------|----------|
| Protocol | `https://` |
| URI Data（先） | `havenring.me/start` |

4. 勾选 **Add PICCDATA**（增加 `picc_data` 占位符）  
5. 勾选 **Enable SUN Message**（增加 `cmac` 占位符）  
6. URI Data 应变为类似：

```
havenring.me/start?picc_data=00000000000000000000000000000000&cmac=0000000000000000
```

7. **记录偏移量 / Record offsets**（TagXplorer 界面会显示，或点击占位符后查看 position）：
   - `picc_data=` 后占位符起始位置 → **PICC offset**
   - `cmac=` 后占位符起始位置 → **MAC offset**

8. 点击 **Write To Tag** → 等待成功提示

9. 回到 **NDEF Operations** → **Read NDEF** → 确认 Payload 含 `picc_data` 与 `cmac` 占位符

---

### 步骤 4 — 启用 SDM 文件设置  
### Step 4 — Enable SDM File Settings

1. **NTAG Operations** → **NTAG 424 DNA** → **Security Management**  
2. **Authenticate First**  
   - Card Key No: `00`  
   - Key: `00000000000000000000000000000000`（空白标签出厂默认）  
3. 认证成功后 → **Get/Change File Settings**  
4. 选择 **NDEF File（File 02）**  
5. 按下列设置（与 Haven / sdm-backend 一致）：

| 参数 Parameter | 设置 Setting |
|----------------|--------------|
| SDM / SUN | **Enabled** |
| Communication Mode | **Plain** |
| UID Mirror | **Enabled**（加密在 picc_data 内） |
| Read Counter Mirror | **Enabled** |
| ASCII Encoding | **Enabled** |
| Encrypt File Data | **Disabled**（方案 A 不需要 enc=） |
| SDM Meta Read Permission | **Key 1** |
| SDM File Read Permission | **Key 2** |
| SDM Read Counter Retrieval | **Key 4** 或 No access |
| NDEF Read Access | **Free / Everyone** |
| PICC Data offset | 步骤 3 记录的值 |
| MAC offset | 步骤 3 记录的值 |
| MAC input offset | 与 MAC offset 相同或按 TagXplorer 自动填充 |

6. 点击 **Change File Settings** → 确认成功

7. **验证 / Verify：** **NDEF Operations** → **Read NDEF** 两次，转 hex 为文本后：
   - `picc_data` 与 `cmac` 不再是全零  
   - 两次读取值 **应不同**（计数器递增）

若仍为全零 → 返回检查 SDM 是否 Enabled、offset 是否正确。  
If still all zeros, recheck SDM enabled and offsets.

---

### 步骤 5 — 计算并更换应用密钥  
### Step 5 — Derive and Change Application Keys

1. 记录本枚戒指 **UID**（步骤 1，如 `04:53:A5:3A:50:23:90`）  
2. 运行密钥脚本，得到 Key0–Key4 共 5 组 32 位 hex  
3. **NTAG Operations** → **NTAG 424 DNA** → **Security Management**  
4. **Authenticate First**（Key No `00`，Old Key 全零）  
5. **Change Key** — 顺序：**先改 01、02、03、04，最后改 00**

每改一把：

| 字段 Field | 说明 Note |
|------------|-----------|
| Card Key No | 01 → 02 → 03 → 04 → 00 |
| Old Key | 当前旧值（首次为全零） |
| New Key | 脚本输出的对应 Key |
| New Key Version | `00` |

6. 改 Key0 后当前会话失效，需重新认证（用**新 Key0**）

> **重要：** 5 把密钥必须与脚本输出 **完全一致**，否则 Haven 验签失败。  
> All five keys must **exactly match** script output.

---

### 步骤 6 — 锁卡策略（Haven 要求：出厂不锁）  
### Step 6 — Lock Policy (Haven: Do NOT Lock)

| 项目 Item | 要求 Requirement |
|-----------|------------------|
| 永久只读 Permanent read-only | ❌ **禁止 Do NOT** |
| NDEF 可写 Writable | ✅ 保持可写 Keep writable |
| Change State → Read-Only | ❌ **不要点击 Do NOT use** |

Haven 通过服务器撤销戒指，不依赖硬件锁。  
Haven revokes rings server-side; no hardware lock required.

---

## 4. 出厂验收 / Acceptance Test (Every Ring)

### 4.1 TagXplorer 读卡

- [ ] IC Type = NTAG 424 DNA  
- [ ] Read NDEF 含 `havenring.me/start`  
- [ ] 连续 Read 两次，`picc_data` 与 `cmac` **会变化**

### 4.2 手机碰戒（Android Chrome）

- [ ] 碰戒打开浏览器  
- [ ] 地址栏含 **`picc_data=`** 和 **`cmac=`**（非全零）  
- [ ] 域名 **`havenring.me`**，路径 **`/start`**

### 4.3 Haven 服务器验签（抽检或全检）

将碰戒 URL 中的参数提交：

```http
POST https://havenring.me/api/rings/sdm/resolve
Content-Type: application/json

{
  "picc_data": "<从 URL 复制>",
  "cmac": "<从 URL 复制>"
}
```

期望 / Expected:

```json
{ "valid": true, "scene": "new_ring_binding" }
```

- [ ] `valid: true`  
- [ ] 无 `Invalid message` / `wrong signature`

---

## 5. 批次记录表 / Batch Record

```
══════════════════════════════════════════════════════════════
 Haven Ring — TagXplorer 烧录批次记录
 Batch Record
══════════════════════════════════════════════════════════════
批次 Batch: ___________  日期 Date: ___________
操作员 Operator: ______  读卡器 Reader: Identiv uTrust 3700 F
MASTER_KEY 版本: v1.0 (a53082d9…092c)
──────────────────────────────────────────────────────────────
序号  UID                 验签 Pass  备注 Notes
No.   (hex)
──────────────────────────────────────────────────────────────
001   ________________    ☐
002   ________________    ☐
003   ________________    ☐
004   ________________    ☐
005   ________________    ☐
──────────────────────────────────────────────────────────────
合格 Passed: ___ / ___     签字 Sign-off: _______________
══════════════════════════════════════════════════════════════
```

---

## 6. 常见问题 / Troubleshooting

| 现象 Symptom | 原因 Cause | 处理 Action |
|--------------|------------|-------------|
| URL 只有 `/start`，无 cmac | 只写了静态 NDEF，未开 SDM | 重做步骤 3–4 |
| picc_data/cmac 始终全零 | SDM 未启用或 offset 错误 | 检查 File Settings |
| 验签失败 wrong signature | 密钥与 MASTER_KEY 不一致 | 核对脚本 UID 与 Change Key |
| Authenticate 失败 | Old Key 错误或顺序错 | 空白戒用全零 Key0 认证 |
| TagXplorer 无 NTAG 424 菜单 | 版本过旧或芯片非 424 | 升级 TagXplorer / 换芯片 |

---

## 7. 与「仅 NDEF Operations 写 URL」的区别  
## Difference vs. NDEF-Only Write

| 方式 Method | 结果 Result |
|-------------|-------------|
| NDEF Operations 只写 `https://havenring.me/start` | ❌ 静态链接，**不能**封存 |
| NTAG Operations + SDM + 密钥（本指导书） | ✅ 动态 URL，**可以**封存 |

**本指导书为唯一合格烧录方式。**  
**This SOP is the only accepted provisioning method.**

---

## 8. 技术参考 / References

- NXP TagXplorer UM11133  
- NXP AN12196（NTAG 424 DNA SDM）  
- Haven 密钥脚本：`scripts/derive-ntag424-keys.py`  
- Haven SDM 后端：与 `MASTER_KEY` 配套部署  

---

## 9. 联系方式 / Contact

烧录或验签问题请联系 Haven 技术对接人：  
For provisioning issues, contact Haven technical liaison:

```
姓名 Name: _______________________
邮箱 Email: ______________________
电话 Phone: ______________________
```

---

**文档结束 / End of Document**
