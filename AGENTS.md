# Repository Guidelines

## Project Structure & Module Organization

This repository is currently a minimal starting point for a QR-code generation tool. The root contains `README.md` for the project overview and `LICENSE` for the MIT license; no application or test code has been committed yet. Keep root-level files limited to project-wide documentation and configuration. When implementation begins, place production code in `src/`, automated tests in `tests/`, and non-code resources such as sample images or fixtures in `assets/`. Mirror source paths in tests where practical, for example `src/encoder.*` and `tests/encoder_test.*`.

## Build, Test, and Development Commands

No build system, dependency manifest, or test runner is configured today. Before adding dependencies, choose tooling appropriate to the implementation language and document the exact commands in `README.md` and this file. Until then, useful repository checks are:

- `git status --short`: review changed and untracked files.
- `git diff --check`: detect whitespace errors before committing.
- `git diff`: inspect the complete local patch.

Do not describe a change as tested unless a reproducible test command exists and has been run.

## Coding Style & Naming Conventions

Use spaces, not tabs. Default to four-space indentation for source code and two spaces for JSON or YAML, unless the selected language's standard formatter requires otherwise. Keep modules focused and use descriptive names tied to QR concepts, such as `QrEncoder`, `error_correction`, or `payloadValidator`. Adopt the ecosystem's standard formatter and linter with the first code contribution, commit their configuration, and avoid unrelated formatting changes.

## Testing Guidelines

Add tests with every behavior change. Store them under `tests/`, name them after the unit under test, and cover normal input, empty input, invalid payloads, Unicode text, and boundary sizes. Prefer deterministic fixtures; generated QR output should be verified by decoding it or comparing stable structural properties rather than fragile screenshots. Document any coverage command once a framework is selected.

## Commit & Pull Request Guidelines

History currently contains only `Initial commit`, so no mature convention exists. Use short, imperative commit subjects such as `Add QR payload validation`; keep each commit logically focused. Pull requests should explain the purpose, implementation approach, and verification performed, link related issues, and include sample output or screenshots for visual changes. Call out new dependencies, compatibility decisions, and follow-up work explicitly.

## Security & Configuration

Never commit secrets, personal payloads, generated private QR codes, or local environment files. Add tool-specific caches and generated output to `.gitignore` when those tools are introduced.

## 工作区边界

- 将 `D:\stud\QRCODE\TP_QRCODE` 视为本项目唯一允许写入的文件系统范围。
- 不得在本项目之外创建、修改、覆盖、移动、重命名或删除任何文件和目录。
- 仅在读取项目所需的官方文档、已安装技能或内置运行时文件时访问项目外路径；读取权限不代表写入权限。
- 不得修改 Codex 全局配置、用户配置、系统目录、其他仓库或 `C:\Users\99350` 下的文件，除非用户明确授权具体目标路径。
- 不得全局安装依赖。项目依赖必须通过本仓库的依赖清单和项目本地环境安装。
- 临时文件、下载内容、生成图片、缓存、截图和测试输出必须保存在本仓库的 `tmp/`、`output/` 或其他项目内目录。
- 执行命令时应将 `D:\stud\QRCODE\TP_QRCODE` 设置为工作目录。
- 如果任务确实需要写入项目外路径，必须停止操作，说明具体路径、目的和影响，并获得用户明确许可后才能继续。
