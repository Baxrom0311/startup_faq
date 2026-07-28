
export const meta = {
  name: 'ultracode-full-audit',
  description: 'Comprehensive audit and improvement of SolutionLab codebase',
  phases: [
    { title: 'Scout', detail: 'Read all key files in parallel' },
    { title: 'Plan', detail: 'Identify improvements per domain' },
    { title: 'Implement', detail: 'Apply fixes and enhancements in parallel' },
    { title: 'Finalize', detail: 'Commit and push' },
  ],
}

// ─── PHASE 1: SCOUT ─────────────────────────────────────────────────────────
phase('Scout')

const [
  searchDialog,
  userProfile,
  layoutTsx,
  submitProblem,
  langSwitcher,
  backendUsers,
  backendProblems,
  backendModels,
  i18n,
  routeTree,
  appSidebar,
] = await parallel([
  () => agent('Read the file /Users/baxrom/ish_full/startup_faq/frontend/src/components/Common/SearchDialog.tsx and return its full contents as a string.', { label: 'read:SearchDialog' }),
  () => agent('Read the file /Users/baxrom/ish_full/startup_faq/frontend/src/routes/_layout/users.$userId.tsx and return its full contents as a string.', { label: 'read:userProfile' }),
  () => agent('Read the file /Users/baxrom/ish_full/startup_faq/frontend/src/routes/_layout.tsx and return its full contents as a string.', { label: 'read:_layout' }),
  () => agent('Read the file /Users/baxrom/ish_full/startup_faq/frontend/src/components/Product/SubmitProblemDialog.tsx and return its full contents as a string.', { label: 'read:SubmitProblem' }),
  () => agent('Read the file /Users/baxrom/ish_full/startup_faq/frontend/src/components/Common/LangSwitcher.tsx and return its full contents as a string.', { label: 'read:LangSwitcher' }),
  () => agent('Read the file /Users/baxrom/ish_full/startup_faq/backend/app/api/routes/users.py and return its full contents as a string.', { label: 'read:backend/users' }),
  () => agent('Read the file /Users/baxrom/ish_full/startup_faq/backend/app/api/routes/problems.py and return its full contents as a string.', { label: 'read:backend/problems' }),
  () => agent('Read the file /Users/baxrom/ish_full/startup_faq/backend/app/models.py and return its full contents as a string (first 300 lines only).', { label: 'read:models' }),
  () => agent('Read the file /Users/baxrom/ish_full/startup_faq/frontend/src/lib/i18n.ts and return its full contents as a string.', { label: 'read:i18n' }),
  () => agent('Read the file /Users/baxrom/ish_full/startup_faq/frontend/src/routeTree.gen.ts and return first 80 lines showing the route registrations.', { label: 'read:routeTree' }),
  () => agent('Read the file /Users/baxrom/ish_full/startup_faq/frontend/src/components/Common/AppSidebar.tsx and return its full contents as a string.', { label: 'read:AppSidebar' }),
])

log('Scout complete — all files read')

// ─── PHASE 2: PLAN ──────────────────────────────────────────────────────────
phase('Plan')

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    improvements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          domain: { type: 'string' },
          title: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          file: { type: 'string' },
          description: { type: 'string' },
          code: { type: 'string' },
        },
        required: ['domain', 'title', 'priority', 'file', 'description'],
      }
    }
  },
  required: ['improvements']
}

const [frontendFindings, backendFindings, uxFindings] = await parallel([
  () => agent(`You are a senior frontend engineer reviewing a React 19 + TypeScript + TanStack Router app called SolutionLab. 
Here is the SearchDialog component:
${searchDialog}

Here is the user profile route:
${userProfile}

Here is the layout route:
${layoutTsx}

Here is i18n file (look for missing keys):
${i18n}

Here is the routeTree:
${routeTree}

Identify concrete, high-impact improvements. Focus on:
1. UX: keyboard navigation in SearchDialog (arrow keys to navigate results, Enter to go), close on Escape
2. Accessibility: aria attributes, role="dialog", focus trap
3. Missing i18n keys in uz/ru/en for new components
4. User profile: missing translations, loading skeleton quality
5. Any bugs or race conditions

Return a structured list of improvements with exact file paths and the complete new code for each change.`, 
  { label: 'plan:frontend', schema: FINDINGS_SCHEMA }),

  () => agent(`You are a senior Python/FastAPI engineer reviewing a backend for SolutionLab.
Here are the relevant files:

users.py:
${backendUsers}

problems.py:
${backendProblems}

models.py:
${backendModels}

Identify concrete improvements:
1. Does /users/{user_id}/profile return created_at? Check if UserProfilePublic includes it
2. Does problems endpoint support author_id filter correctly?
3. Any missing validation, error handling, or response model issues
4. Any security issues (missing auth, IDOR, etc.)
5. Missing indexes or query optimizations

Return structured findings with file paths and exact code fixes.`,
  { label: 'plan:backend', schema: FINDINGS_SCHEMA }),

  () => agent(`You are a UX engineer reviewing SolutionLab. Here are the key files:

AppSidebar:
${appSidebar}

LangSwitcher:
${langSwitcher}

SubmitProblemDialog (audio recording):
${submitProblem}

Identify improvements:
1. Audio recording UX: is there a progress bar? Waveform visualization? Max duration limit?
2. LangSwitcher: does the fix from the previous session fully work?
3. AppSidebar: any missing links to user profile page?
4. Mobile responsiveness issues
5. Any missing loading/error states

Return structured findings with file paths and code.`,
  { label: 'plan:ux', schema: FINDINGS_SCHEMA }),
])

const allFindings = [
  ...(frontendFindings?.improvements || []),
  ...(backendFindings?.improvements || []),
  ...(uxFindings?.improvements || []),
].filter(Boolean)

log(`Found ${allFindings.length} total improvements`)

// Group by priority
const high = allFindings.filter(f => f.priority === 'high')
const medium = allFindings.filter(f => f.priority === 'medium')
const toImplement = [...high, ...medium].slice(0, 8) // cap at 8

log(`Implementing ${toImplement.length} high+medium priority improvements`)

// ─── PHASE 3: IMPLEMENT ─────────────────────────────────────────────────────
phase('Implement')

const implementations = await parallel(
  toImplement.map((finding, idx) => () =>
    agent(`You are implementing a specific improvement in the SolutionLab codebase.

IMPROVEMENT:
Title: ${finding.title}
Domain: ${finding.domain}
File: ${finding.file}
Priority: ${finding.priority}
Description: ${finding.description}
${finding.code ? `Suggested code:\n${finding.code}` : ''}

CONTEXT about the project:
- React 19 + TypeScript frontend at /Users/baxrom/ish_full/startup_faq/frontend/
- FastAPI backend at /Users/baxrom/ish_full/startup_faq/backend/
- TanStack Router with file-based routing
- i18next with uz/ru/en translations in /Users/baxrom/ish_full/startup_faq/frontend/src/lib/i18n.ts
- All UI components use shadcn/ui
- Backend: SQLModel + FastAPI

INSTRUCTIONS:
1. First READ the target file to get exact current content
2. Make the minimal correct change using Edit tool
3. If i18n keys are added, also update i18n.ts in all 3 languages
4. Do NOT break existing functionality
5. Do NOT add comments explaining what you did
6. If the file does not need changing (already implemented), say so

Report back: what you changed and what file(s) were modified.`,
    { label: `impl:${finding.title.slice(0,30)}`, isolation: 'worktree' })
  )
)

log('Implementations complete')

// ─── PHASE 4: FINALIZE ──────────────────────────────────────────────────────
phase('Finalize')

const summary = await agent(`You are finalizing the ultracode pass for SolutionLab.

Here is what was planned and implemented:

FINDINGS (${allFindings.length} total, ${toImplement.length} attempted):
${toImplement.map((f, i) => `${i+1}. [${f.priority.toUpperCase()}] ${f.domain}: ${f.title} — ${f.file}`).join('\n')}

IMPLEMENTATION RESULTS:
${implementations.filter(Boolean).map((r, i) => `${i+1}. ${r}`).join('\n')}

Now:
1. Run: cd /Users/baxrom/ish_full/startup_faq && git add -A && git status
2. Check what changed
3. Commit everything with a comprehensive message
4. Push to origin main

The commit message should list all improvements made. Use this format:
git commit -m "feat: ultracode — [brief summary of what was improved]"

Include Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

Execute the git add, commit, and push commands now.`,
{ label: 'finalize:commit' })

return {
  total_findings: allFindings.length,
  implemented: toImplement.length,
  high_priority: high.length,
  medium_priority: medium.length,
  findings_summary: toImplement.map(f => `[${f.priority}] ${f.domain}: ${f.title}`),
  summary,
}
