import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { test } from "node:test";

// 使用本地已有 Playwright；CI 可用 PLAYWRIGHT_MODULE 指定模块路径，无需向应用添加运行时依赖。
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseUrl = process.env.ADMIN_UI_URL || "http://127.0.0.1:5173";
const shots = process.env.ADMIN_UI_SCREENSHOTS;
const fixture = `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body><div id="fixture"></div><script type="module">
import { createApp, h, reactive } from '/node_modules/.vite/deps/vue.js';
import AppPagination from '/src/components/AppPagination.vue';
import { ElDatePicker, ElInput, ElOption, ElSelect } from '/node_modules/.vite/deps/element-plus.js';
import '/node_modules/element-plus/es/components/input/style/css.mjs';
import '/node_modules/element-plus/es/components/select/style/css.mjs';
import '/node_modules/element-plus/es/components/date-picker/style/css.mjs';
import '/node_modules/element-plus/theme-chalk/dark/css-vars.css';
import '/src/style.css';
const state = reactive({ page: 1, pageSize: 20, total: 200, pageSizes: [10, 20, 50, 100], merchant: '' });
window.paginationState = state;
window.paginationEvents = [];
createApp({ setup: () => () => h('div', { style: 'padding:16px;max-width:1200px;margin:auto' }, [
  h('aside', { style: 'position:static;height:auto;width:220px;margin-bottom:16px' }, [
    h('nav', {}, [h('button', { class: 'active' }, '侧栏菜单')])
  ]),
  h('section', { class: 'panel', style: 'padding:16px;min-width:0' }, [
    h('p', {}, '分页与表单回归测试（合成数据，不连接业务接口）'),
    h(AppPagination, { ...state,
      onChange(page) { window.paginationEvents.push(['page', page]); state.page = page; },
      onSizeChange(size) { window.paginationEvents.push(['size', size]); state.pageSize = size; state.page = 1; }
    }),
    h('div', { class: 'management-filter-fields', style: 'margin-top:24px' }, [
      h('label', { class: 'management-form-item' }, [h('span', {}, '日期'), h(ElDatePicker, { type: 'datetimerange', startPlaceholder: '开始时间', endPlaceholder: '结束时间' })]),
      h('label', { class: 'management-form-item' }, [h('span', {}, '商户'), h(ElSelect, { modelValue: state.merchant, 'onUpdate:modelValue': value => state.merchant = value, filterable: true, placeholder: '选择商户' }, () => h(ElOption, { label: '测试商户', value: 'test' }))]),
      h('label', { class: 'management-form-item' }, [h('span', {}, '普通输入框'), h(ElInput, { placeholder: '测试输入' })])
    ])
  ])
]) }).mount('#fixture');
</script></body></html>`;

test("管理后台分页与表单浏览器回归", async (t) => {
  const browser = await chromium.launch({ chromiumSandbox: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/__admin-ui-check", route => route.fulfill({ contentType: "text/html", body: fixture }));
  await page.goto(`${baseUrl}/__admin-ui-check`);
  const pager = page.getByRole("navigation", { name: "分页", exact: true });
  await pager.waitFor();
  const set = async (values) => {
    await page.evaluate(values => Object.assign(window.paginationState, values), values);
    await page.waitForFunction(values => Object.entries(values).every(([key, value]) => JSON.stringify(window.paginationState[key]) === JSON.stringify(value)), values);
    // Vue 的 DOM patch 在下一个微任务完成。
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  };
  const active = () => pager.locator('[aria-current="page"]').innerText();
  const jump = pager.getByRole("textbox", { name: "跳转页码" });

  await t.test("侧栏样式不污染分页按钮和每页条数", async () => {
    assert.equal(await page.locator('aside button').evaluate(el => getComputedStyle(el).width), "192px");
    for (const button of await pager.getByRole("button").all()) {
      const box = await button.boundingBox();
      assert.ok(box.width >= 28 && box.width <= 64, `分页按钮宽度 ${box.width}`);
    }
    assert.ok((await pager.getByRole("combobox").boundingBox()).width < 150);
    assert.equal((await pager.getByRole("textbox", { name: "跳转页码" }).boundingBox()).width, 52);
    assert.equal(await active(), "1");
    assert.ok(await pager.getByRole("button", { name: "上一页", exact: true }).isDisabled());
  });

  await t.test("下一页、页码按钮、末页和禁用状态", async () => {
    await pager.getByRole("button", { name: "下一页", exact: true }).click();
    assert.equal(await active(), "2");
    await pager.getByRole("button", { name: "第 10 页", exact: true }).click();
    assert.equal(await active(), "10");
    assert.ok(await pager.getByRole("button", { name: "下一页", exact: true }).isDisabled());
    await pager.getByRole("button", { name: "上一页", exact: true }).click();
    assert.equal(await active(), "9");
  });

  await t.test("跳转提交、上下界及小数和科学计数输入", async () => {
    await jump.fill("4"); await jump.press("Enter"); assert.equal(await active(), "4");
    await jump.fill("999"); await jump.blur(); assert.equal(await active(), "10");
    await jump.fill("0"); await jump.press("Enter"); assert.equal(await active(), "1");
    for (const draft of ["1.5", "1e2", "-2", "abc", ""]) {
      await jump.fill(draft); await jump.press("Enter"); assert.equal(await active(), "1");
    }
    const before = await page.evaluate(() => window.paginationEvents.length);
    await jump.fill("2"); await jump.press("Enter"); await jump.blur();
    assert.equal(await page.evaluate(() => window.paginationEvents.length), before + 1);
  });

  await t.test("每页条数切换回第一页，自定义条数与空列表", async () => {
    await pager.getByRole("combobox").selectOption("50");
    assert.equal(await active(), "1");
    assert.match(await pager.innerText(), /第 1 \/ 4 页，共 200/);
    await set({ pageSize: 15 });
    assert.equal(await pager.getByRole("combobox").inputValue(), "15");
    await set({ page: 8, total: 0 });
    assert.match(await pager.innerText(), /第 1 \/ 1 页，共 0/);
    assert.equal(await active(), "1");
    for (const button of await pager.getByRole("button").all()) assert.ok(await button.isDisabled());
    assert.ok(await jump.isDisabled());
    await set({ page: 1, pageSize: 20, total: 200 });
  });

  await t.test("首尾页码窗口、中间省略号与七页以内完整显示", async () => {
    const pages = () => pager.locator('.pagination-page').allInnerTexts();
    assert.deepEqual(await pages(), ["1", "2", "3", "4", "5", "10"]);
    await set({ page: 6, total: 400 });
    assert.deepEqual(await pages(), ["1", "5", "6", "7", "20"]);
    assert.equal(await pager.locator('.pagination-dots').count(), 2);
    await set({ page: 20 });
    assert.deepEqual(await pages(), ["1", "16", "17", "18", "19", "20"]);
    await set({ page: 1, total: 140 });
    assert.deepEqual(await pages(), ["1", "2", "3", "4", "5", "6", "7"]);
  });

  await t.test("日期、可搜索下拉框与输入框不被原生表单样式覆盖", async () => {
    for (const selector of ['.el-input__inner', '.el-select__input', '.el-range-input']) {
      for (const input of await page.locator(selector).all()) {
        assert.equal(await input.evaluate(el => getComputedStyle(el).borderTopWidth), "0px", selector);
      }
    }
    const date = page.locator('.el-date-editor');
    assert.ok((await date.boundingBox()).width <= await date.evaluate(el => el.parentElement.clientWidth));
    const select = page.locator('.el-select');
    await select.click();
    await page.getByRole('option', { name: '测试商户', exact: true }).click();
    assert.match(await select.innerText(), /测试商户/);
    await page.locator('.el-date-editor').click();
    await page.locator('.el-picker-panel').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.panel > p').click();
    await page.locator('.el-picker-panel').waitFor({ state: 'hidden' });
  });

  await t.test("1440/1024/768/390/320 宽度和暗色主题无横向溢出", async () => {
    await set({ page: 6, total: 400 });
    if (shots) await mkdir(shots, { recursive: true });
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `页面在 ${width}px 溢出`);
      const overflow = await pager.evaluate(el => el.scrollWidth > el.clientWidth + 1);
      assert.ok(!overflow, `分页在 ${width}px 溢出`);
      if (shots) await page.screenshot({ path: `${shots}/pagination-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'midnight';
      document.documentElement.classList.add('dark');
    });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.pagination-page.active')).color === 'rgb(7, 13, 22)');
    if (shots) await page.screenshot({ path: `${shots}/pagination-midnight.png`, fullPage: true, animations: 'disabled' });
    assert.deepEqual(errors, []);
  });
});
