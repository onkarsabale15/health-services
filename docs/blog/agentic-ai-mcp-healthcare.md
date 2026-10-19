# The year the AI learned to use the hospital's tools

*Agentic AI, MCP, and what the 2026 spec release quietly unlocks for healthcare*

After building with AI for a while, the novelty of "it can write" wears off and a more practical question takes over: *can it actually do anything?*

For most of the last two years, the answer in healthcare was "sort of." A model could summarize a discharge note and then have no way to pull the next patient's labs. It could reason about a drug interaction and then not write the order. It lived in a chat box — we handed it text, it handed text back, and a human did all the actual work of reaching into systems.

That gap — between a model that can think and a model that can act — is what agentic AI is really about. In healthcare it's also where it gets hard, because the systems an agent needs to reach into are EHRs: decades-old, vendor-specific, locked-down, and rightly cautious about who touches patient data.

This post walks through how that gap is closing, what the Model Context Protocol (MCP) has to do with it, how it lines up with SMART on FHIR, and why a protocol update that got almost no attention — **MCP's 2026 authorization release** — might matter more for clinical AI than any new model. I'm writing it from direct experience: I've been building exactly this on the side, and I ran straight into the wall this release helps with.

---

## 1. From chatbots to agents

"Agentic AI" gets thrown around loosely, so let me be concrete.

A chatbot is a function: text in, text out. An **agent** is a loop. It looks at a goal, picks an action, takes that action against the real world, looks at what happened, and decides again. The difference isn't intelligence — it's *hands*. An agent has tools it can call, and it can chain those calls to get something done.

The catch is always the tools. Every system you want an agent to touch — the EHR, scheduling, a terminology service — speaks its own language. So historically every AI integration was bespoke: a hand-written wrapper for Epic, a different one for Cerner, glue for the next vendor, and a brittle adapter layer that broke whenever something upstream changed. You weren't building intelligence. You were building plumbing, over and over.

That's the problem MCP set out to solve.

---

## 2. What MCP actually is, without the jargon

The Model Context Protocol is a simple idea: **a standard way for an AI to discover and call tools.** Instead of every app inventing its own tool format, MCP defines one. A server exposes a catalog of tools — each with a name, a description the model can read, and a schema for its inputs. A client (Claude, or any agent) connects, asks "what can you do here?", and gets back a menu it understands.

Think USB. Before USB, every device had its own connector and you kept a drawer full of adapters. After USB, you plugged things in and they worked. MCP is the USB port for AI tools: build one server for your system, and *any* MCP-speaking agent can use it — today's model and next year's.

The design principle I keep coming back to is **"dumb tools, smart client."** The tools shouldn't try to be clever. A tool that reads a patient is just a tool that reads a patient — it mirrors the underlying capability one-to-one, returns the raw data, and gets out of the way. The intelligence (which patient, why, what to do with the result) lives in the agent. The moment you bake judgment into the tool layer, you've rebuilt the brittle-adapter problem with extra steps. Keep the tools honest and narrow; let the model be the smart one.

---

## 3. How I got here

Around January this year I started building side projects in US healthcare, mostly chasing the same AI buzz the whole industry has been chasing.

The first one was simple: use an LLM to help providers make more informed decisions from a patient's history. It grew into an app that could generate a **care plan, recommendations, care gaps, missing screenings, and patient-safety notes and suggestions** — a clinical decision support (CDS) app, basically. Feed it the patient's record, get back something a clinician can review and act on.

Building it, I kept thinking: this is just *one* flow. In real healthcare engineering there are dozens of flows like it — each one some mix of LLM calls, EHR API calls, and data transformations. So after the CDS proof-of-concept, I started a second one: an **n8n-style, drag-and-drop workflow builder** for US healthcare, so a developer could wire those steps together visually instead of hand-coding every integration.

And while building *that*, another thought crept in: why make someone open an application at all? What if you could just **talk** to it — text or voice — and let the AI do the reaching? Someone using a chatbot, or Claude or ChatGPT or Gemini, could ask for an analysis, pull information, or even write back to the chart — not by clicking through EHR screens, but by asking. That's the thread that led me to MCP, and specifically to the question I've been chewing on since: **how do you build a multi-EHR MCP server for healthcare?**

So I did the research and started building one — an MCP server that exposes EHR APIs as agent tools. Thin, narrow tools (read a patient, search conditions, pull observations, write a condition), generated from typed methods so adding a capability just makes it show up in the catalog. The useful part showed up fast: once the plumbing worked, the surface an agent could act on grew almost for free. The hard part showed up right after.

---

## 4. The wall: system apps work, provider launch doesn't

In a hobby project you give your agent a tool and a token and you're off. In healthcare, every call has to answer questions that aren't optional: *who is this, really* (a credentialed entity, scoped to this org, allowed to touch **this** patient's data)? *What are they allowed to do* (a read is not a write; a headless integration is not a clinician at the bedside)? And *can you prove it later*, since every access is an audit event?

I got the MCP server far enough to test it against real EHRs, and testing is where the limitation showed itself. With MCP's support as it stood, the only mode that worked cleanly was **system applications** — the headless, backend-to-backend case, where the server authenticates as itself (client credentials) and there's no human in the loop. Genuinely useful, but only half the story.

The half that *didn't* work was the provider-facing one: **standalone SMART on FHIR launch** and **EHR launch** apps — where a clinician is the one acting, and access has to be tied to their identity, their session, and the patient and encounter they launched into. That's the flow that actually matters at the bedside, and there wasn't a clean way to do it. You could force it with hacks and workarounds, but nothing I'd want sitting in front of real patient data.

I kept testing anyway — the tools worked, the catalog worked, the system path worked. But I knew that provider-launch gap was the thing standing between a neat demo and something a clinic could actually use. So rather than hand-roll a fragile auth layer the standard was clearly about to address, I paused the MCP work, locked in what was solid, and waited for the protocol to catch up.

That wait is what just got interesting.

---

## 5. The release that changes the math: MCP's 2026 authorization model

Then I read about the upcoming RC changes to MCP's **2026 release** — and that's what got me excited enough to pick the project back up. The work landing there isn't a new model trick; it's authorization, aimed squarely at **enterprise readiness**. The center of gravity has shifted from "can the agent call tools at all?" to "can it do so the way a regulated industry requires?", and the 2026 spec answers that by building the protocol's identity and access story on **OAuth 2.0 and OpenID Connect** — the same standards the rest of serious software already runs on, and the exact same foundation the provider-launch flows I was blocked on depend on.

That matters more than it sounds. The earlier authorization work (which began taking shape in the 2025 spec) proved the direction; the **2026 release is where it matures into something you can actually deploy in a regulated environment** — tighter client identity, real enterprise IdP integration, cleaner discovery and scoping. The 2026-07-28 release candidate is already in flight, and that's the version a healthcare build wants to bet on. It replaces "every server improvises its own security" with a real, shared authorization model. Almost every piece of it maps directly onto a problem I'd been wrestling with in my own build:

- **OAuth Client Credentials** — first-class machine-to-machine authorization. This is *exactly* the headless/system case: a backend agent authenticating as itself, no human in the loop, with a token that actually means something. It's the thing I'd hand-rolled — now handled by the spec the same way every other backend service does it.
- **Client ID Metadata Documents (CIMD)** — replaces fiddly Dynamic Client Registration with URL-based registration: a client identifies itself with a URL pointing to a JSON document it manages. Much cleaner for onboarding clients into a platform, and far easier to reason about than a registration endpoint everyone implements slightly differently.
- **OpenID Connect Discovery + standardized default scopes** — so a client and server can discover each other and agree on "what is this client allowed to do" by the book, instead of each side inventing its own answer.
- **Cross-App Access / enterprise IdP controls** — sign in to the MCP client once and reach every authorized server without re-prompting. For a multi-app platform — a FHIR gateway, a CDS app, a workflow engine, an admin plane — that's the enterprise SSO story handed to you instead of stitched together by hand.
- **URL-mode elicitation** — secure out-of-band interactions where secrets like API keys and passwords *never transit through the MCP client*. In a PHI world, that's not a nicety; it's the line between deployable and not.

It's all backward compatible, so you adopt the pieces you need — but the important part is that the authorization model a healthcare deployment leans on is no longer something each of us reinvents. It's in the protocol.

There's one more piece worth calling out, because it's a direct win for clinical AI:

- **Async Tasks** — any request can become "call now, fetch later," moving through states like `working`, `input_required`, `completed`, `failed`, and `cancelled`. AI care-plan generation isn't a 200ms lookup; it's a reasoning job that takes real time. Until now that meant hacky polling or holding a connection open and hoping. A standard task primitive means a clinician can kick off an analysis, go see the next patient, and come back to a finished result — modeled by the protocol instead of bolted on top of it.

For my project, concretely, this is the green light I'd been waiting on. The tools are built and the catalog is ready; what was missing was a clean way to support the provider-facing launches. With the OAuth/OIDC work in the 2026 release, **securely launching EHR apps and supporting standalone SMART launch through MCP gets sorted by the standard itself — no hack, no workaround.** The headless system path I already had keeps working; the provider-launch path I was blocked on becomes something I can build on a vetted foundation instead of one I invented and have to defend by myself. That's why I'm resuming the MCP server.

### What a secured call actually looks like

To make it concrete, here's the shape of a single tool call under this model, end to end:

1. The agent (the MCP client) gets a token from the authorization server — via **client credentials** for a headless system integration, or a user-driven OAuth flow when a clinician is in the loop.
2. That token carries **scopes** (what this client may do) and identity (who it is, which organization it belongs to). It is not a blank check.
3. The MCP server verifies the token, checks its scope against the tool being called, confirms the request is inside the right tenant and patient context — and only then lets the call reach the EHR.
4. The whole thing is an **audit event**: who, what, when, against which resource.

None of those steps are new ideas — they're how OAuth has worked for years. The point is that MCP's 2026 model speaks them natively, so I'm not reinventing each one and hoping I got the security right.

---

## 6. Where SMART on FHIR fits — and why MCP suddenly rhymes with it

Healthcare already has a hard-won standard for "let an app reach into the EHR safely": **SMART on FHIR** (Substitutable Medical Applications and Reusable Technologies). It defines how a clinical app launches from inside an EHR and gets *scoped, authorized* access to patient data — and it's built squarely on **OAuth 2.0 and OpenID Connect**, with patient/encounter context, granular scopes, and clinician identity baked in.

For years, SMART on FHIR and the AI world spoke different dialects. MCP's 2026 authorization model is what makes the two genuinely rhyme:

- **Same foundation.** SMART on FHIR is OAuth 2.0 + OIDC. MCP's 2026 authorization is OAuth-native too — client credentials, OIDC discovery, standardized scopes. They're no longer two unrelated security models you have to bridge by hand; they're the same primitives pointed at the same goal.
- **An MCP server can *be* a SMART-on-FHIR-shaped front door.** You wrap your FHIR/EHR layer as an MCP server, carry SMART's patient- and encounter-scoping through into the tool calls, and let the OAuth/OIDC layer enforce who-can-touch-what. The agent gets EHR tools; the EHR gets a request that looks like a well-behaved SMART client — properly scoped and audited.
- **The launch context survives.** SMART's notion of "this session is for *this* patient and *this* encounter" maps cleanly onto a scoped MCP session — so an agent doesn't roam the whole record; it operates inside the same guardrails a SMART app would. This is the exact pattern I'm building toward: a SMART launch hands over patient + encounter context, and the MCP tools inherit that scope rather than getting open access.

The honest caveat: MCP out of the box isn't HIPAA-complete. You still layer in encryption, role-based access, audit, and PHI handling around it. But the gap between "AI agent" and "SMART on FHIR app" used to be a chasm of custom security code. With the 2026 authorization model, it's a short, standards-based bridge — and you build it once.

---

## 7. What this unlocks at the bedside

Strip away the protocol talk and here's what it adds up to for the people who matter — clinicians and patients.

An agent that can *act* on a properly-secured tool surface is an agent that can do the dull, dangerous, time-eating work that sits between a doctor and their patient:

- Pull the full picture for the visit — conditions, meds, labs, allergies — without the clinician clicking through six screens.
- Surface an evidence-based recommendation *at the encounter*, scoped to the patient in front of them, instead of in a report nobody reads.
- Draft the care plan so the human edits instead of types.
- Flag the drug interaction before the order, not after.

None of that asks the AI to be a doctor. It asks the AI to be a fast, tireless, trustworthy pair of hands — hands that operate *inside* the guardrails. And the thing that makes this safe to want is exactly the thing that never trends: the boring auth layer, the audit trail, the scoped permissions, the standard everyone can inspect.

---

## 8. Where this leaves us

The hype wants clinical AI to be one model that replaces judgment. The version I'm building toward is more modest, and more useful: ordinary clinical systems, exposed as narrow tools, behind real security, that any capable agent can use — with every action scoped and logged.

Agentic AI gave us the loop. MCP gave us the standard tool surface. SMART on FHIR gave healthcare its scoped-access discipline. And **MCP's 2026 authorization release** — OAuth-native, with client credentials, OIDC discovery, metadata-based client identity, standardized scopes, and async tasks — adds the piece you can't deploy without: a standard, auditable way to let an agent reach into the system without anyone guessing about who's reaching and why. It's the unglamorous machinery that moves a demo toward something a hospital's security team can actually sign off on.

I started this trail back in January with a CDS app, wandered through a workflow builder, and landed on a multi-EHR MCP server because I wanted clinicians to just *talk* to their data. The system path worked; the provider-launch path was the wall. With the 2026 authorization work, that wall comes down through the standard rather than around it — so I'm picking the MCP server back up.

It's not a smarter model that unlocks healthcare AI. It's a trustworthy way in. That was always going to be the part that mattered.

---

### Sources

- [The 2026-07-28 MCP Specification Release Candidate — MCP Blog](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)
- [Client Registration and Enterprise Management in the MCP Authorization Spec — Aaron Parecki](https://aaronparecki.com/2025/11/25/1/mcp-authorization-spec-update)
- [MCP authorization: async Tasks, OAuth client credentials, extensions — WorkOS](https://workos.com/blog/mcp-2025-11-25-spec-update)
- [MCP Authorization — specification changelog](https://modelcontextprotocol.io/specification/2025-11-25/changelog)
- [One Year of MCP — MCP Blog (origin of the authorization work)](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/)
- [SMART App Launch v2.2.0 — Launch and Authorization (HL7)](https://build.fhir.org/ig/HL7/smart-app-launch/app-launch.html)
- [SMART on FHIR Authorization: Best Practices — SMART Health IT](https://docs.smarthealthit.org/authorization/best-practices/)
- [MCP: The Protocol That Solves the Integration Problem in GenAI — Invene](https://www.invene.com/blog/mcp-the-protocol-that-solves-the-integration-problem-in-genai)
