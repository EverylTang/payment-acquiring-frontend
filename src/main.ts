import { createApp, h } from "vue";
import App from "./App.vue";
import LoginView from "./LoginView.vue";
import { authState, restoreSession } from "./auth";
import "./style.css";

const Root = {
  setup: () => () =>
    authState.ready ? h(authState.user ? App : LoginView) : null,
};
restoreSession().finally(() => createApp(Root).mount("#app"));
