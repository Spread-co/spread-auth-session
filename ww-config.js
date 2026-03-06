export default {
  editor: {
    label: { en: 'Spread Auth Session' },
    icon: 'lock',
    categories: ['other'],
  },
  properties: {
    supabaseUrl: {
      label: { en: 'Supabase URL' },
      type: 'Text',
      bindable: true,
      defaultValue: '',
      hidden: true,
    },
    supabaseAnonKey: {
      label: { en: 'Supabase Anon Key' },
      type: 'Text',
      bindable: true,
      defaultValue: '',
      hidden: true,
    },
    mode: {
      label: { en: 'Mode' },
      type: 'TextSelect',
      options: {
        options: [
          { value: 'login', label: { en: 'Login' } },
          { value: 'signup', label: { en: 'Sign Up' } },
        ],
      },
      bindable: true,
      defaultValue: 'login',
    },
    showToggle: {
      label: { en: 'Show Login/Signup Toggle' },
      type: 'OnOff',
      defaultValue: true,
    },
    showForgotPassword: {
      label: { en: 'Show Forgot Password Link' },
      type: 'OnOff',
      defaultValue: true,
    },
    heading: {
      label: { en: 'Heading Text' },
      type: 'Text',
      bindable: true,
      defaultValue: '',
      /* wwEditor:start */
      section: 'settings',
      /* wwEditor:end */
    },
    subheading: {
      label: { en: 'Subheading Text' },
      type: 'Text',
      bindable: true,
      defaultValue: '',
      /* wwEditor:start */
      section: 'settings',
      /* wwEditor:end */
    },
  },
  triggerEvents: [
    {
      name: 'session:ready',
      label: { en: 'On Session Ready' },
      event: {
        userId: '',
        email: '',
        displayName: '',
        accessToken: '',
        refreshToken: '',
        roles: [],
        portalTarget: '',
        primaryRole: '',
      },
    },
    {
      name: 'session:error',
      label: { en: 'On Auth Error' },
      event: { message: '', code: '' },
    },
    {
      name: 'session:logout',
      label: { en: 'On Logout' },
      event: {},
    },
    {
      name: 'session:signup-confirm',
      label: { en: 'On Signup Confirmation Required' },
      event: { email: '' },
    },
    {
      name: 'session:password-reset',
      label: { en: 'On Password Reset Requested' },
      event: { email: '' },
    },
  ],
};
