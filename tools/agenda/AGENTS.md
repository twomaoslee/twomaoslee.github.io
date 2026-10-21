# 日程维护约定

- `source/` 为网页的可移交权威源代码；`source/data/conference-latest.json` 为分会场数据，`source/data/main-programs.json` 为主会场与专题。
- 修改日程前先获取远端最新版本。不得从旧 PDF/Excel 重新生成并覆盖现有内部 ID，不得直接修改生成后的压缩 `static/agenda/conference-data.js`。
- 参会者收藏以内部 `id` 为键，显示报告编号 `number` 与内部 ID 可以不同。单纯改题目、时间时保留两者。用户要求编号时段固定、只对调报告时，必须按已有身份对应关系处理，不得把原 ID 赋给另一位讲者。
- 执行 `node tools/agenda/source/validate.cjs`、`node tools/agenda/source/build.cjs`，并运行 `node --test tools/agenda/admin/*.test.cjs`。
- 小程序是独立产物，网页后台不会更新它；用户明确要求时再同步。
- 管理配置、密码、Git 凭证和状态目录不得提交。管理员 API 不得开放任意 Git 指令、文件路径、脚本或 ID 修改；所有发布必须经过差异确认与远端版本检查。
- 发布仅修改日程源数据和 `static/agenda/`。回退是恢复历史数据的新提交，不得重置整个主页或强推历史。
