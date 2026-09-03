import { createApp, h } from "vue";
import App from "./App.vue";
import LoginView from "./modules/auth/LoginView.vue";
import { authState, restoreSession } from "./auth";
import { installLocaleObserver } from "./preferences";
import "./style.css";

const Root = {
  setup: () => () =>
    authState.ready ? h(authState.user ? App : LoginView) : null,
};
restoreSession().finally(() => {
  createApp(Root).mount("#app");
  installLocaleObserver();
});
