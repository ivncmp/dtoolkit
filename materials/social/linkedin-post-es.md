# LinkedIn Post — Español

> Tono: técnico pero cercano, storytelling personal, sin hype vacío.

---

Llevo meses trabajando con agentes de código (Claude Code, Gemini CLI, Codex, OpenCode) y siempre me encontraba con los mismos problemas:

- Cada sesión empieza de cero. El agente no recuerda nada.
- No sabe en qué proyecto estás, ni qué decisiones tomaste ayer.
- Si quieres cambiar de proveedor, tienes que reescribir todo.
- No tienes ni idea de cuánto te cuesta ni dónde falla.

Así que construí dtoolkit.

dtoolkit es un toolkit de ingeniería open-source para agentes de código. No es otro wrapper de LLMs — es la infraestructura que les falta: memoria, contexto, gestión de proyectos y observabilidad.

La idea es simple: una capa, un trabajo.

🧠 **dbrain** — Memoria persistente. SQLite + FTS5, servidor MCP, federación entre brains personales y de equipo. Tu agente recuerda decisiones, preferencias y contexto de proyecto entre sesiones.

🔗 **dcontext** — Hooks automáticos. Inyecta identidad y hechos del proyecto al inicio de cada sesión. Guarda transcripciones antes de que se pierdan por compactación. Zero config.

🔀 **dproxy** — Un CLI, cuatro proveedores. Claude, Gemini, Codex, OpenCode. Cambia con un flag. REST API incluida.

📋 **dwork** — Project manager AI-native. Markdown es la fuente de verdad. Kanban, búsqueda FTS5, 21 herramientas MCP incluyendo code graph. SQLite es solo un índice.

📊 **dops** — Observabilidad. Tokens, costes, herramientas, tasa de éxito, errores. Dashboard con gráficas y timeseries. Ingesta multi-proveedor.

Y luego: SDK tipado, 4 adapters, codegraph-sdk para inteligencia de código... 20 paquetes en total. Todo MIT, todo composable.

Filosofía:
- CLI-first, dashboard como bonus
- SQLite everywhere (cero dependencias externas)
- MCP + REST en el mismo puerto
- Markdown como fuente de verdad
- Sin vendor lock-in

Está en producción. Lo uso todos los días. Mi agente sabe quién soy, en qué proyecto estoy, qué decidí la semana pasada, y cuánto me costó la sesión anterior.

Si trabajas con agentes de código y quieres que dejen de ser amnésicos:

→ GitHub: github.com/ivncmp/dtoolkit
→ npm: @dtoolkit/*
→ Docs: dtoolkit.dev/docs

v1.0.0 acaba de salir. Feedback bienvenido.

#OpenSource #AIEngineering #DeveloperTools #CodingAgents #MCP
