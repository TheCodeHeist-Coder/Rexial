# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for a security vulnerability.** A public
report tells everyone about the weakness before there is a fix.

Instead, use GitHub's private reporting:

1. Go to the [Security tab](https://github.com/TheCodeHeist-Coder/Rexial/security/advisories/new)
2. Click **Report a vulnerability**
3. Describe the issue and how to reproduce it

This creates a private advisory only the maintainers can see.

> Maintainers: private reporting must be switched on once, under
> Settings → Code security and analysis → Private vulnerability reporting.

## What to include

The more of this you can give us, the faster we can act:

- What kind of issue it is (authentication bypass, injection, XSS, exposed
  secret, and so on)
- Which service is affected — `http-server`, `ws-server`, `frontend`, `genAI`,
  or the database layer
- File paths and the affected version or commit
- Step-by-step reproduction, ideally with a minimal example
- What an attacker could do with it

## What to expect

Rexial is maintained by a small team, so please treat these as intentions
rather than guarantees:

| Stage | Target |
|---|---|
| Acknowledgement | within 72 hours |
| Initial assessment | within 7 days |
| Fix or mitigation plan | depends on severity, communicated in the assessment |

We will keep you updated as we work, and credit you in the advisory when the
fix ships unless you would rather stay anonymous.

## Scope

Rexial is a self-hosted application, so this policy covers the **code in this
repository**. Your own deployment — your server hardening, your API keys, your
database configuration — is yours to secure.

Areas worth particular attention:

- Authentication and JWT handling in `apps/http-server`
- Quiz join-code generation and guessability
- WebSocket message authorisation in `apps/ws-server` — can a participant send
  a host-only message?
- File upload handling in `apps/genAI` (PDF parsing)
- Prompt injection through uploaded documents
- Secrets accidentally committed to the repository

## Out of scope

- Vulnerabilities in third-party dependencies that already have a public CVE
  and an available upgrade — please open a normal issue or PR instead
- Denial of service through sheer traffic volume against a self-hosted instance
- Social engineering of maintainers or contributors
- Findings from automated scanners with no demonstrated exploit

## Good practice when self-hosting

- Set a strong, unique `JWT_SECRET` — never the example value from the docs
- Keep `.env` files out of version control (`.gitignore` already covers them)
- Do not expose PostgreSQL or Redis directly to the internet
- Serve the application over HTTPS
- Rotate API keys if you suspect they have leaked

Thank you for helping keep Rexial and its users safe.
