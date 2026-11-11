import { createApp, h } from "vue";
// Element Plus 按需样式:只引入实际使用的组件(链式自带 base 根变量与依赖组件),
// 替代全量 element-plus/dist/index.css(~340KB)。新增 EP 组件时在此补对应 style/css。
import "element-plus/es/components/date-picker/style/css";
import "element-plus/es/components/form/style/css";
// form/tabs 的 style 链不含子组件样式,需显式引入 form-item 与 tab-pane。
import "element-plus/es/components/form-item/style/css";
import "element-plus/es/components/tab-pane/style/css";
import "element-plus/es/components/input-number/style/css";
import "element-plus/es/components/loading/style/css";
import "element-plus/es/components/select/style/css";
import "element-plus/es/components/table/style/css";
import "element-plus/es/components/table-column/style/css";
import "element-plus/es/components/tabs/style/css";
// 暗色仅覆盖 CSS 变量,由 <html class="dark"> 激活(midnight 主题时挂上)。
import "element-plus/theme-chalk/dark/css-vars.css";
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
