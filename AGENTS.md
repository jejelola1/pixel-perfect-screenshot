<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

Admin role changes must use the authenticated `set_admin_role` database function, not direct role writes, so permission checks, self-demotion protection and audit records cannot be bypassed.
Signup creates ordinary users only; administrator bootstrap requires a verified requester identity to prevent first-signup privilege capture.
Timed publication uses published status with a future published_at (and scheduled_for for admin visibility); public queries and RLS exclude future timestamps, so content becomes visible at its due time without a scheduler.
Site identity is a singleton public-read/admin-write site_settings record; shared branding context drives logo, name, favicon and semantic light/dark theme tokens so saved settings apply across pages.
