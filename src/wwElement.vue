<template>
  <div class="spread-auth-session" :class="{ 'spread-auth-session--loading': loading }">
    <!-- Session restoring spinner (shown during auto-restore on mount) -->
    <div class="spread-auth-session__restoring" v-if="sessionRestoring">
      <span class="spread-auth-session__spinner spread-auth-session__spinner--lg"></span>
      <p class="spread-auth-session__restoring-text">Restoring session…</p>
    </div>

    <!-- Auth form (hidden when authenticated or restoring) -->
    <template v-if="!wwIsAuthenticated && !sessionRestoring">
    <!-- Heading -->
    <div class="spread-auth-session__header" v-if="displayHeading || displaySubheading">
      <h2 class="spread-auth-session__title" v-if="displayHeading">{{ displayHeading }}</h2>
      <p class="spread-auth-session__subtitle" v-if="displaySubheading">{{ displaySubheading }}</p>
    </div>

    <!-- Auth Form -->
    <form
      class="spread-auth-session__form"
      @submit.prevent="handleSubmit"
      novalidate
      v-if="!confirmationSent"
    >
      <!-- Display Name (signup only) -->
      <div class="spread-auth-session__field" v-if="currentMode === 'signup'">
        <label class="spread-auth-session__label" for="spread-auth-name">Full name</label>
        <input
          id="spread-auth-name"
          class="spread-auth-session__input"
          type="text"
          v-model="name"
          placeholder="Your full name"
          autocomplete="name"
        />
      </div>

      <!-- Email -->
      <div class="spread-auth-session__field">
        <label class="spread-auth-session__label" for="spread-auth-email">Email</label>
        <input
          id="spread-auth-email"
          class="spread-auth-session__input"
          :class="{ 'spread-auth-session__input--error': emailError }"
          type="email"
          v-model="email"
          placeholder="you@example.com"
          autocomplete="email"
          required
        />
        <span class="spread-auth-session__error-text" v-if="emailError">{{ emailError }}</span>
      </div>

      <!-- Password -->
      <div class="spread-auth-session__field" v-if="!forgotMode">
        <label class="spread-auth-session__label" for="spread-auth-password">Password</label>
        <input
          id="spread-auth-password"
          class="spread-auth-session__input"
          :class="{ 'spread-auth-session__input--error': passwordError }"
          type="password"
          v-model="password"
          placeholder="••••••••"
          :autocomplete="currentMode === 'signup' ? 'new-password' : 'current-password'"
          required
        />
        <span class="spread-auth-session__error-text" v-if="passwordError">{{ passwordError }}</span>
      </div>

      <!-- General error -->
      <div class="spread-auth-session__alert" v-if="generalError">
        <span class="spread-auth-session__alert-icon">!</span>
        <span>{{ generalError }}</span>
      </div>

      <!-- Submit button -->
      <button
        class="spread-auth-session__btn"
        type="submit"
        :disabled="loading"
      >
        <span v-if="loading" class="spread-auth-session__spinner"></span>
        <span v-else>{{ submitLabel }}</span>
      </button>

      <!-- Forgot password link -->
      <div class="spread-auth-session__links" v-if="content.showForgotPassword && currentMode === 'login' && !forgotMode">
        <button
          type="button"
          class="spread-auth-session__link"
          @click="forgotMode = true"
        >
          Forgot password?
        </button>
      </div>

      <!-- Back to login (from forgot password mode) -->
      <div class="spread-auth-session__links" v-if="forgotMode">
        <button
          type="button"
          class="spread-auth-session__link"
          @click="forgotMode = false"
        >
          Back to login
        </button>
      </div>

      <!-- Login / Signup toggle -->
      <div class="spread-auth-session__toggle" v-if="content.showToggle && !forgotMode">
        <span class="spread-auth-session__toggle-text">
          {{ currentMode === 'login' ? "Don't have an account?" : 'Already have an account?' }}
        </span>
        <button
          type="button"
          class="spread-auth-session__link"
          @click="toggleMode"
        >
          {{ currentMode === 'login' ? 'Sign up' : 'Log in' }}
        </button>
      </div>
    </form>

    <!-- Confirmation message (post-signup or post-forgot-password) -->
    <div class="spread-auth-session__confirm" v-if="confirmationSent">
      <div class="spread-auth-session__confirm-icon">✉</div>
      <h3 class="spread-auth-session__confirm-title">Check your email</h3>
      <p class="spread-auth-session__confirm-text">
        We've sent a {{ forgotMode ? 'password reset' : 'confirmation' }} link to
        <strong>{{ email }}</strong>.
      </p>
      <button
        type="button"
        class="spread-auth-session__link"
        @click="resetForm"
      >
        Back to login
      </button>
    </div>
    </template><!-- end v-if !authenticated && !restoring -->
  </div>
</template>

<script>
// ── Inline Auth Helpers (no shared lib imports — each component is its own repo) ──

async function signIn({ email, password, supabaseUrl, supabaseAnonKey }) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error_description: res.statusText }));
    throw new Error(err.error_description || err.msg || `Login failed (${res.status})`);
  }
  return res.json();
}

async function signUp({ email, password, supabaseUrl, supabaseAnonKey, metadata = {} }) {
  const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey },
    body: JSON.stringify({ email, password, data: metadata }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error_description: res.statusText }));
    throw new Error(err.error_description || err.msg || `Signup failed (${res.status})`);
  }
  return res.json();
}

async function signOut({ accessToken, supabaseUrl, supabaseAnonKey }) {
  const res = await fetch(`${supabaseUrl}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  if (!res.ok && res.status !== 401) {
    throw new Error(`Logout failed (${res.status})`);
  }
}

async function refreshSession({ refreshToken, supabaseUrl, supabaseAnonKey }) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error_description: res.statusText }));
    throw new Error(err.error_description || err.msg || `Refresh failed (${res.status})`);
  }
  return res.json();
}

async function getUser({ accessToken, supabaseUrl, supabaseAnonKey }) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Get user failed (${res.status})`);
  }
  return res.json();
}

function resolvePortal(roles) {
  if (!roles || roles.length === 0) return 'member';
  const sorted = [...roles].sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99));
  if (sorted.some(r => r.is_internal === true)) return 'admin';
  if (sorted.some(r => r.scope_type === 'farmer')) return 'farmer';
  return 'member';
}

function primaryRole(roles) {
  if (!roles || roles.length === 0) return null;
  const sorted = [...roles].sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99));
  return sorted[0].key;
}

// ── Cookie Helpers (complies with Golden Rule #4 — no localStorage) ──

const COOKIE_NAME = 'spread_rt';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function writeRefreshCookie(token) {
  try {
    const doc = wwLib.getFrontDocument();
    if (!doc) return;
    doc.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Strict; Secure`;
  } catch (_) { /* editor mode — ignore */ }
}

function readRefreshCookie() {
  try {
    const doc = wwLib.getFrontDocument();
    if (!doc) return null;
    const match = doc.cookie.split('; ').find(c => c.startsWith(`${COOKIE_NAME}=`));
    return match ? decodeURIComponent(match.split('=')[1]) : null;
  } catch (_) { return null; }
}

function clearRefreshCookie() {
  try {
    const doc = wwLib.getFrontDocument();
    if (!doc) return;
    doc.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Strict; Secure`;
  } catch (_) { /* editor mode — ignore */ }
}

// ── Inline Supabase Client ──

function createSpreadClient({ supabaseUrl, supabaseAnonKey, accessToken = null }) {
  const headers = { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  return {
    async from(table, { select = '*', filters = '', limit = null, order = null } = {}) {
      let url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
      if (filters) url += `&${filters}`;
      if (limit) url += `&limit=${limit}`;
      if (order) url += `&order=${order}`;
      const res = await fetch(url, { method: 'GET', headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(`Query ${table}: ${err.message || res.status}`);
      }
      return res.json();
    },
    async rpc(fn, params = {}) {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
        method: 'POST', headers, body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(`RPC ${fn}: ${err.message || res.status}`);
      }
      return res.json();
    },
  };
}

const REFRESH_INTERVAL_MS = 55 * 60 * 1000; // 55 minutes
const BROADCAST_CHANNEL = 'spread-auth';

export default {
  props: {
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
    content: { type: Object, required: true },
    wwFrontState: { type: Object, required: true },
    wwElementState: { type: Object, required: true },
  },

  emits: ['trigger-event', 'update:content'],

  setup(props) {
    // Expose session state as WeWeb component variables
    const { value: wwAccessToken, setValue: setWwAccessToken } =
      wwLib.wwVariable.useComponentVariable({
        uid: 'accessToken',
        name: 'Access Token',
        type: 'string',
        defaultValue: '',
      });
    const { value: wwUserId, setValue: setWwUserId } =
      wwLib.wwVariable.useComponentVariable({
        uid: 'userId',
        name: 'User ID',
        type: 'string',
        defaultValue: '',
      });
    const { value: wwPortalTarget, setValue: setWwPortalTarget } =
      wwLib.wwVariable.useComponentVariable({
        uid: 'portalTarget',
        name: 'Portal Target',
        type: 'string',
        defaultValue: '',
      });
    const { value: wwIsAuthenticated, setValue: setWwIsAuthenticated } =
      wwLib.wwVariable.useComponentVariable({
        uid: 'isAuthenticated',
        name: 'Is Authenticated',
        type: 'boolean',
        defaultValue: false,
      });
    const { value: wwUserEmail, setValue: setWwUserEmail } =
      wwLib.wwVariable.useComponentVariable({
        uid: 'userEmail',
        name: 'User Email',
        type: 'string',
        defaultValue: '',
      });
    const { value: wwDisplayName, setValue: setWwDisplayName } =
      wwLib.wwVariable.useComponentVariable({
        uid: 'displayName',
        name: 'Display Name',
        type: 'string',
        defaultValue: '',
      });
    const { value: wwPrimaryRole, setValue: setWwPrimaryRole } =
      wwLib.wwVariable.useComponentVariable({
        uid: 'primaryRole',
        name: 'Primary Role',
        type: 'string',
        defaultValue: '',
      });
    const { value: wwRoles, setValue: setWwRoles } =
      wwLib.wwVariable.useComponentVariable({
        uid: 'roles',
        name: 'User Roles',
        type: 'array',
        defaultValue: [],
      });
    const { value: wwPlatformAccessMode, setValue: setWwPlatformAccessMode } =
      wwLib.wwVariable.useComponentVariable({
        uid: 'platformAccessMode',
        name: 'Platform Access Mode',
        type: 'string',
        defaultValue: 'members_only',
      });
    const { value: wwNonMemberMarkupPct, setValue: setWwNonMemberMarkupPct } =
      wwLib.wwVariable.useComponentVariable({
        uid: 'nonMemberMarkupPct',
        name: 'Non-Member Markup %',
        type: 'number',
        defaultValue: 0,
      });
    const { value: wwMemberReserveWindowDays, setValue: setWwMemberReserveWindowDays } =
      wwLib.wwVariable.useComponentVariable({
        uid: 'memberReserveWindowDays',
        name: 'Member Reserve Window (Days)',
        type: 'number',
        defaultValue: 90,
      });

    return {
      wwAccessToken, setWwAccessToken,
      wwUserId, setWwUserId,
      wwPortalTarget, setWwPortalTarget,
      wwIsAuthenticated, setWwIsAuthenticated,
      wwUserEmail, setWwUserEmail,
      wwDisplayName, setWwDisplayName,
      wwPrimaryRole, setWwPrimaryRole,
      wwRoles, setWwRoles,
      wwPlatformAccessMode, setWwPlatformAccessMode,
      wwNonMemberMarkupPct, setWwNonMemberMarkupPct,
      wwMemberReserveWindowDays, setWwMemberReserveWindowDays,
    };
  },

  data() {
    return {
      email: '',
      password: '',
      name: '',
      loading: false,
      generalError: null,
      emailError: null,
      passwordError: null,
      confirmationSent: false,
      forgotMode: false,
      currentMode: this.content?.mode || 'login',
      refreshTimer: null,
      _refreshToken: null,
      _channel: null,
      sessionRestoring: false,
    };
  },

  computed: {
    displayHeading() {
      if (this.content.heading) return this.content.heading;
      if (this.forgotMode) return 'Reset password';
      return this.currentMode === 'login' ? 'Welcome back' : 'Create your account';
    },
    displaySubheading() {
      if (this.content.subheading) return this.content.subheading;
      if (this.forgotMode) return 'Enter your email and we\'ll send you a reset link.';
      return this.currentMode === 'login'
        ? 'Sign in to your Spread.co account'
        : 'Join Spread.co for farm-fresh groceries';
    },
    submitLabel() {
      if (this.forgotMode) return 'Send reset link';
      return this.currentMode === 'login' ? 'Sign in' : 'Create account';
    },
  },

  watch: {
    'content.mode'(newMode) {
      if (newMode && newMode !== this.currentMode) {
        this.currentMode = newMode;
        this.clearErrors();
      }
    },
  },

  async mounted() {
    // ── Session restore from cookie ──
    const savedToken = readRefreshCookie();
    if (savedToken) {
      const { supabaseUrl, supabaseAnonKey } = this.content;
      if (supabaseUrl && supabaseAnonKey) {
        this.sessionRestoring = true;
        try {
          const session = await refreshSession({
            refreshToken: savedToken,
            supabaseUrl,
            supabaseAnonKey,
          });
          await this.establishSession(session, supabaseUrl, supabaseAnonKey);
        } catch (err) {
          console.warn('Session restore failed:', err.message);
          clearRefreshCookie();
          this.$emit('trigger-event', {
            name: 'session:expired',
            event: { reason: 'token_stale' },
          });
        } finally {
          this.sessionRestoring = false;
        }
      }
    }

    // ── Fetch platform settings (always — works for both anon and authed) ──
    await this.fetchPlatformSettings();

    // ── Cross-tab sync via BroadcastChannel ──
    try {
      const win = wwLib.getFrontWindow();
      if (win && typeof win.BroadcastChannel === 'function') {
        this._channel = new win.BroadcastChannel(BROADCAST_CHANNEL);
        this._channel.onmessage = async (ev) => {
          const data = ev.data;
          if (!data || !data.type) return;

          if (data.type === 'logout') {
            this.clearSession();
            this.$emit('trigger-event', { name: 'session:logout', event: {} });
          } else if (data.type === 'login' && data.refreshToken) {
            const { supabaseUrl, supabaseAnonKey } = this.content;
            if (!supabaseUrl || !supabaseAnonKey) return;
            try {
              const session = await refreshSession({
                refreshToken: data.refreshToken,
                supabaseUrl,
                supabaseAnonKey,
              });
              await this.establishSession(session, supabaseUrl, supabaseAnonKey, { broadcast: false });
            } catch (_) {
              // Cross-tab sync is best-effort
            }
          }
        };
      }
    } catch (_) {
      // BroadcastChannel not available — skip cross-tab sync
    }
  },

  beforeUnmount() {
    this.stopRefreshTimer();
    // Close BroadcastChannel
    try {
      if (this._channel) {
        this._channel.close();
        this._channel = null;
      }
    } catch (_) {}
  },

  methods: {
    // ── Validation ──────────────────────────────────────────────────────
    validate() {
      this.clearErrors();
      let valid = true;

      if (!this.email || !this.email.includes('@')) {
        this.emailError = 'Please enter a valid email address.';
        valid = false;
      }
      if (!this.forgotMode && (!this.password || this.password.length < 6)) {
        this.passwordError = 'Password must be at least 6 characters.';
        valid = false;
      }
      return valid;
    },

    clearErrors() {
      this.generalError = null;
      this.emailError = null;
      this.passwordError = null;
    },

    // ── Form submit ─────────────────────────────────────────────────────
    async handleSubmit() {
      if (!this.validate()) return;
      this.loading = true;
      this.generalError = null;

      try {
        if (this.forgotMode) {
          await this.handleForgotPassword();
          return;
        }

        if (this.currentMode === 'signup') {
          await this.handleSignup();
        } else {
          await this.handleLogin();
        }
      } catch (err) {
        this.generalError = err.message || 'An unexpected error occurred.';
        this.$emit('trigger-event', {
          name: 'session:error',
          event: { message: err.message, code: err.code || '' },
        });
      } finally {
        this.loading = false;
      }
    },

    async handleLogin() {
      const { supabaseUrl, supabaseAnonKey } = this.content;

      const session = await signIn({
        email: this.email,
        password: this.password,
        supabaseUrl,
        supabaseAnonKey,
      });

      await this.establishSession(session, supabaseUrl, supabaseAnonKey);
    },

    async handleSignup() {
      const { supabaseUrl, supabaseAnonKey } = this.content;

      const result = await signUp({
        email: this.email,
        password: this.password,
        supabaseUrl,
        supabaseAnonKey,
        metadata: { display_name: this.name || undefined },
      });

      // If email confirmation is required, Supabase returns a user but no access_token
      if (!result.access_token) {
        this.confirmationSent = true;
        this.$emit('trigger-event', {
          name: 'session:signup-confirm',
          event: { email: this.email },
        });
        return;
      }

      // Auto-confirmed signup — establish session immediately
      await this.establishSession(result, supabaseUrl, supabaseAnonKey);
    },

    async handleForgotPassword() {
      const { supabaseUrl, supabaseAnonKey } = this.content;

      const res = await fetch(`${supabaseUrl}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ email: this.email }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error_description: res.statusText }));
        throw new Error(err.error_description || err.msg || `Reset failed (${res.status})`);
      }

      this.confirmationSent = true;
      this.loading = false;
      this.$emit('trigger-event', {
        name: 'session:password-reset',
        event: { email: this.email },
      });
    },

    // ── Session establishment ───────────────────────────────────────────
    async establishSession(session, supabaseUrl, supabaseAnonKey, { broadcast = true } = {}) {
      const accessToken = session.access_token;
      this._refreshToken = session.refresh_token;

      // Persist refresh token in secure cookie
      writeRefreshCookie(this._refreshToken);

      // Create authenticated Supabase client
      const client = createSpreadClient({ supabaseUrl, supabaseAnonKey, accessToken });

      // Fetch user profile
      const user = await getUser({ accessToken, supabaseUrl, supabaseAnonKey });

      // Fetch user roles with role metadata via PostgREST embedded select
      let roles = [];
      try {
        roles = await client.from('user_roles', {
          select: 'role_id,scope_type,scope_id,roles(key,tier,is_internal)',
          filters: `user_id=eq.${user.id}`,
        });
      } catch (e) {
        // If role fetch fails (e.g. no roles assigned), default to empty
        console.warn('Failed to fetch user roles:', e.message);
      }

      // Flatten the nested roles object from PostgREST response
      const flatRoles = (roles || []).map(r => ({
        key: r.roles?.key || 'unknown',
        tier: r.roles?.tier ?? 99,
        is_internal: r.roles?.is_internal ?? false,
        scope_type: r.scope_type || '',
        scope_id: r.scope_id || '',
      }));

      const portal = resolvePortal(flatRoles);
      const topRole = primaryRole(flatRoles);

      // Get display name from profile or user metadata
      let displayName = user.user_metadata?.display_name || '';
      if (!displayName) {
        try {
          const profiles = await client.from('profiles', {
            select: 'display_name',
            filters: `user_id=eq.${user.id}`,
            limit: 1,
          });
          displayName = profiles?.[0]?.display_name || '';
        } catch (_) {
          // Profile fetch is optional
        }
      }

      // Update WeWeb component variables
      this.setWwAccessToken(accessToken);
      this.setWwUserId(user.id);
      this.setWwUserEmail(user.email);
      this.setWwDisplayName(displayName);
      this.setWwPortalTarget(portal);
      this.setWwIsAuthenticated(true);
      this.setWwPrimaryRole(topRole || '');
      this.setWwRoles(flatRoles);

      // Emit session ready event for WeWeb workflows
      this.$emit('trigger-event', {
        name: 'session:ready',
        event: {
          userId: user.id,
          email: user.email,
          displayName,
          accessToken,
          refreshToken: this._refreshToken,
          roles: flatRoles,
          portalTarget: portal,
          primaryRole: topRole || '',
          platformAccessMode: this.wwPlatformAccessMode,
          nonMemberMarkupPct: this.wwNonMemberMarkupPct,
        },
      });

      // Broadcast login to other tabs
      if (broadcast && this._channel) {
        try {
          this._channel.postMessage({ type: 'login', refreshToken: this._refreshToken });
        } catch (_) {}
      }

      // Start token refresh timer
      this.startRefreshTimer(supabaseUrl, supabaseAnonKey);
    },

    // ── Token refresh ───────────────────────────────────────────────────
    startRefreshTimer(supabaseUrl, supabaseAnonKey) {
      this.stopRefreshTimer();
      this.refreshTimer = setInterval(async () => {
        try {
          if (!this._refreshToken) return;
          const session = await refreshSession({
            refreshToken: this._refreshToken,
            supabaseUrl,
            supabaseAnonKey,
          });
          this._refreshToken = session.refresh_token;
          this.setWwAccessToken(session.access_token);
          writeRefreshCookie(this._refreshToken);
        } catch (err) {
          console.warn('Token refresh failed:', err.message);
          // On refresh failure, session is stale — clear state
          this.clearSession();
          this.$emit('trigger-event', {
            name: 'session:expired',
            event: { reason: 'refresh_failed' },
          });
        }
      }, REFRESH_INTERVAL_MS);
    },

    stopRefreshTimer() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
    },

    // ── Logout ──────────────────────────────────────────────────────────
    async logout() {
      const { supabaseUrl, supabaseAnonKey } = this.content;
      const token = this.wwAccessToken;

      // Broadcast logout to other tabs
      if (this._channel) {
        try { this._channel.postMessage({ type: 'logout' }); } catch (_) {}
      }

      this.clearSession();

      try {
        if (token) {
          await signOut({ accessToken: token, supabaseUrl, supabaseAnonKey });
        }
      } catch (_) {
        // Best-effort logout — already cleared local state
      }

      this.$emit('trigger-event', {
        name: 'session:logout',
        event: {},
      });
    },

    clearSession() {
      this.stopRefreshTimer();
      this._refreshToken = null;
      clearRefreshCookie();
      this.setWwAccessToken('');
      this.setWwUserId('');
      this.setWwUserEmail('');
      this.setWwDisplayName('');
      this.setWwPortalTarget('');
      this.setWwIsAuthenticated(false);
      this.setWwPrimaryRole('');
      this.setWwRoles([]);
      // Note: platform settings are NOT cleared on logout — they apply to all visitors
    },

    // ── Platform settings ───────────────────────────────────────────────
    async fetchPlatformSettings() {
      const { supabaseUrl, supabaseAnonKey } = this.content;
      if (!supabaseUrl || !supabaseAnonKey) return;
      try {
        const client = createSpreadClient({ supabaseUrl, supabaseAnonKey });
        const settings = await client.rpc('get_platform_settings');
        if (settings) {
          this.setWwPlatformAccessMode(settings.access_mode || 'members_only');
          this.setWwNonMemberMarkupPct(Number(settings.non_member_markup_pct) || 0);
          this.setWwMemberReserveWindowDays(Number(settings.member_reserve_window_days) ?? 90);
        }
      } catch (err) {
        console.warn('Failed to fetch platform settings:', err.message);
        // Default to members_only (safe fallback)
        this.setWwPlatformAccessMode('members_only');
        this.setWwNonMemberMarkupPct(0);
        this.setWwMemberReserveWindowDays(90);
      }
    },

    // ── UI helpers ──────────────────────────────────────────────────────
    toggleMode() {
      this.currentMode = this.currentMode === 'login' ? 'signup' : 'login';
      this.clearErrors();
      this.forgotMode = false;
      this.confirmationSent = false;
    },

    resetForm() {
      this.confirmationSent = false;
      this.forgotMode = false;
      this.currentMode = 'login';
      this.email = '';
      this.password = '';
      this.name = '';
      this.clearErrors();
    },
  },

  /* wwEditor:start */
  // Expose logout method to WeWeb workflows
  wwEditorMethods: {
    logout: 'logout',
  },
  /* wwEditor:end */
};
</script>

<style scoped>
/* ── Design Tokens (from shared/styles/design-tokens.css) ──────────────── */
.spread-auth-session {
  --_primary: #4B162D;
  --_accent: #CE6632;
  --_accent-hover: #B85A2B;
  --_black: #141414;
  --_text-secondary: #2B2B2B;
  --_text-tertiary: #4B5563;
  --_text-disabled: #6B7280;
  --_surface: #FFFFFF;
  --_background: #FBFAF8;
  --_border: #F3EADF;
  --_error: #D14343;
  --_error-bg: #FEF2F2;
  --_error-border: #FECACA;
  --_radius-md: 12px;
  --_radius-lg: 16px;
  --_shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --_font: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

/* ── Container ───────────────────────────────────────────────────────────── */
.spread-auth-session {
  font-family: var(--_font);
  max-width: 420px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  background: var(--_surface);
  border-radius: var(--_radius-lg);
  box-shadow: var(--_shadow-md);
  box-sizing: border-box;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.spread-auth-session__header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.spread-auth-session__title {
  font-size: 22px;
  font-weight: 900;
  color: var(--_primary);
  margin: 0 0 0.25rem;
  line-height: 1.25;
}

.spread-auth-session__subtitle {
  font-size: 14px;
  font-weight: 400;
  color: var(--_text-tertiary);
  margin: 0;
  line-height: 1.7;
}

/* ── Form fields ─────────────────────────────────────────────────────────── */
.spread-auth-session__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.spread-auth-session__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.spread-auth-session__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--_black);
}

.spread-auth-session__input {
  font-family: var(--_font);
  font-size: 14px;
  padding: 10px 12px;
  border: 1px solid var(--_border);
  border-radius: var(--_radius-md);
  background: var(--_background);
  color: var(--_black);
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.spread-auth-session__input:focus {
  border-color: var(--_accent);
  box-shadow: 0 0 0 3px rgba(206, 102, 50, 0.12);
}

.spread-auth-session__input--error {
  border-color: var(--_error);
}

.spread-auth-session__input::placeholder {
  color: var(--_text-disabled);
}

.spread-auth-session__error-text {
  font-size: 12px;
  color: var(--_error);
  margin-top: 2px;
}

/* ── Alert ───────────────────────────────────────────────────────────────── */
.spread-auth-session__alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 10px 12px;
  background: var(--_error-bg);
  border: 1px solid var(--_error-border);
  border-radius: var(--_radius-md);
  font-size: 13px;
  color: var(--_error);
}

.spread-auth-session__alert-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--_error);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

/* ── Submit button ───────────────────────────────────────────────────────── */
.spread-auth-session__btn {
  font-family: var(--_font);
  font-size: 14px;
  font-weight: 600;
  padding: 12px 18px;
  border: none;
  border-radius: var(--_radius-md);
  background: var(--_accent);
  color: #fff;
  cursor: pointer;
  transition: background-color 0.15s ease, opacity 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.spread-auth-session__btn:hover:not(:disabled) {
  background: var(--_accent-hover);
}

.spread-auth-session__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */
.spread-auth-session__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spread-auth-spin 0.6s linear infinite;
}

@keyframes spread-auth-spin {
  to { transform: rotate(360deg); }
}

.spread-auth-session__spinner--lg {
  width: 32px;
  height: 32px;
  border-width: 3px;
  border-color: rgba(206, 102, 50, 0.2);
  border-top-color: var(--_accent);
}

/* ── Session restoring state ─────────────────────────────────────────────── */
.spread-auth-session__restoring {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  gap: 1rem;
}

.spread-auth-session__restoring-text {
  font-size: 14px;
  color: var(--_text-tertiary);
  margin: 0;
}

/* ── Links ───────────────────────────────────────────────────────────────── */
.spread-auth-session__links,
.spread-auth-session__toggle {
  text-align: center;
  margin-top: 0.25rem;
}

.spread-auth-session__toggle-text {
  font-size: 13px;
  color: var(--_text-tertiary);
}

.spread-auth-session__link {
  font-family: var(--_font);
  font-size: 13px;
  font-weight: 600;
  color: var(--_accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-decoration: none;
  transition: color 0.15s ease;
}

.spread-auth-session__link:hover {
  color: var(--_accent-hover);
  text-decoration: underline;
}

/* ── Confirmation state ──────────────────────────────────────────────────── */
.spread-auth-session__confirm {
  text-align: center;
  padding: 1rem 0;
}

.spread-auth-session__confirm-icon {
  font-size: 40px;
  margin-bottom: 0.75rem;
}

.spread-auth-session__confirm-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--_primary);
  margin: 0 0 0.5rem;
}

.spread-auth-session__confirm-text {
  font-size: 14px;
  color: var(--_text-secondary);
  line-height: 1.7;
  margin: 0 0 1rem;
}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 480px) {
  .spread-auth-session {
    padding: 1.5rem 1rem;
    border-radius: 0;
    box-shadow: none;
    max-width: 100%;
  }
}
</style>
