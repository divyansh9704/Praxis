# Contributing to Praxis

First, thank you for considering contributing to Praxis! It's people like you that make Praxis a world-class AI desktop environment. 

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Please report unacceptable behavior to the project maintainers.

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally: `git clone https://github.com/YOUR_USERNAME/praxis.git`
3. **Install dependencies**: 
   - Node.js (v18+)
   - Rust (latest stable)
   - Tauri CLI (`npm install -g @tauri-apps/cli`)
4. **Run the development server**:
   ```bash
   npm install
   npm run tauri dev
   ```

## Development Workflow

### Branch Strategy
- `main` is the primary branch. It should always be stable and deployable.
- Create feature branches from `main` using the format `type/short-description`.
  - `feat/add-anthropic-support`
  - `fix/keychain-persistence`
  - `docs/update-architecture`

### Commit Convention
We follow [Conventional Commits](https://www.conventionalcommits.org/).
- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation only changes
- `style:` Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor:` A code change that neither fixes a bug nor adds a feature
- `perf:` A code change that improves performance
- `test:` Adding missing tests or correcting existing tests
- `chore:` Changes to the build process or auxiliary tools and libraries

### Pull Request Guidelines

1. **Update documentation**: If you change functionality, update the relevant files in `docs/`.
2. **Format code**: Run `npm run format` and `cargo fmt` before committing.
3. **Lint code**: Ensure `cargo clippy` and `npm run lint` pass without errors.
4. **Keep PRs small**: Focused PRs are reviewed and merged much faster.
5. **Describe your changes**: Use the provided Pull Request template to explain the *why* and *how* of your changes.

## Issue Guidelines

- **Bug Reports**: Please use the Bug Report template. Include OS, Praxis version, and steps to reproduce.
- **Feature Requests**: Please use the Feature Request template. Explain the use case and why it benefits the broader community.

## Architecture Guidelines

Praxis relies heavily on **Workspace Isolation** and the **TrustTier** permission model. 
When introducing new IPC commands in Rust, you **must**:
1. Check `TrustTier` before executing any sensitive operation.
2. Resolve paths canonically to ensure they do not escape the active workspace.
3. Add an entry to the Audit Log (`db.rs`) for any state-mutating operation.

See `docs/ARCHITECTURE.md` for more details.
