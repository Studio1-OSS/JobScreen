# Security

## Reporting a vulnerability

Please report it privately with GitHub's **Report a vulnerability** button on the repository's Security tab, not in a public issue.

## Running JobScreen safely

- **Set `JOBSCREEN_ACCESS_KEY` on any public deployment.** Without it, anyone who finds the URL can spend your Nebius credits.
- Resumes are personal data. JobScreen stores nothing on the server; results stay in the reviewer's browser (IndexedDB). Clear them with **Clear all**.
- Page images are sent to your model provider (Nebius Token Factory by default). Check that their terms fit your hiring process and jurisdiction.
- Resume content is treated as untrusted input. The scorer is told never to follow instructions in a resume, and text hidden in a PDF is detected and kept away from the vision model.
