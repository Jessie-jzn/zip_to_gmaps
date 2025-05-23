// 获取浏览器当前语言设置，优先使用 navigator.language，否则使用兼容旧浏览器的 userLanguage
const lang = navigator.language || navigator.userLanguage;
// 判断是否为中文用户，后续用于语言包选择
const isChinese = lang.startsWith("zh");

// 语言包
const i18n = {
  zh: {
    title: "WHV邮编地图助手",
    label: '请输入澳大利亚邮编（支持顿号、逗号及范围，例如"2832至2836"）：',
    button: "📍 标注到地图",
    hintHtml: `
    ⚠️ 请确保已在 Google 地图中创建上方指定名称的列表。
    <p>📌 使用前请在 <strong>Google 地图</strong> 中手动创建一个保存列表（如"🦘澳洲WHV集签列表"）</p>
    <p>① 打开 Google 地图 → 菜单 → 已保存 → 列表 → 新建列表</p>
    <p>② 创建完成后，请将该列表名称填写在上方输入框中</p>
    <p>③ 然后输入要标记的澳洲邮编，点击下方按钮即可批量加入地图标记</p>
  `,
    placeholder: "例如：2356、2386、2396、2832至2836、2899",
    inputPlaceholder: "请输入邮编",
    customListLabel: "自定义列表名称：",
    defaultListName: "🦘澳洲WHV农场/肉场/建筑类集签列表",
    processingStatus: "正在处理...",
    completeStatus: "处理完成",
    useOnMapsError: "请在谷歌地图页面使用此扩展",
    noListsFound: "没有找到可用的列表",
    loadFailed: "加载用户列表失败:",
    initFailed: "初始化失败:",
    markFailed: "标注失败:",
    errorPrefix: "发生错误：",
    waitElementTimeout: "等待元素 %s 超时",
    skipPostcode: "未找到保存按钮，跳过邮编 %s",
    postcodeAlreadySaved: "邮编 %s 已经保存，跳过",
    postcodeMarked: "已标注邮编: %s",
    postcodeMarkFailed: "标注邮编 %s 失败:",
    postcodePlaceholder: "邮政编码: %s, Australia",
    copyIcon: "📋 点击复制",
    copied: "已复制到剪贴板!",
  },
  en: {
    title: "WHV Postcode Marker",
    label:
      'Enter Australian postcodes (supports comma, Chinese list comma and range, e.g. "2832 to 2836"):',
    button: "📍 Mark on Map",
    hintHtml: `
    ⚠️ Please make sure you have created a Google Maps list with the name specified above.
    <p>📌 Before using, please manually create a list in <strong>Google Maps</strong> (e.g., "🦘WHV Jobs List").</p>
    <p>① Open Google Maps → Menu → Saved → Lists → New List</p>
    <p>② After creating it, enter the list name into the input box above.</p>
    <p>③ Then input the Australian postcodes and click the button below to mark them in bulk.</p>
  `,
    placeholder: "e.g. 2356, 2386, 2396, 2832 to 2836, 2899",
    inputPlaceholder: "Please enter postcodes",
    customListLabel: "Custom List Name:",
    defaultListName: "🦘澳洲WHV农场/肉场/建筑类集签列表",
    processingStatus: "Processing...",
    completeStatus: "Completed",
    useOnMapsError: "Please use this extension on a Google Maps page",
    noListsFound: "No available lists found",
    loadFailed: "Failed to load user lists:",
    initFailed: "Initialization failed:",
    markFailed: "Marking failed:",
    errorPrefix: "Error occurred: ",
    waitElementTimeout: "Waiting for element %s timed out",
    skipPostcode: "Save button not found, skipping postcode %s",
    postcodeAlreadySaved: "Postcode %s already saved, skipping",
    postcodeMarked: "Marked postcode: %s",
    postcodeMarkFailed: "Failed to mark postcode %s:",
    postcodePlaceholder: "Postcode: %s, Australia",
    copied: "Copied to clipboard!",
    copyIcon: "📋 Click to copy",
  },
};
// 根据当前语言设置选择语言包
const langPack = isChinese ? i18n.zh : i18n.en;

/**
 * 异步函数：从浏览器的本地存储（Chrome extension 提供的 API）中获取自定义列表名称
 * 本地存储的 key 是 'customListName'
 * 如果用户从未设置过，就返回默认值 langPack.defaultListName
 */
// 从本地存储获取自定义列表名称
async function getCustomListName() {
  const result = (await chrome.storage?.local?.get("customListName")) || {};
  return result.customListName || langPack.defaultListName;
}

/**
 * 异步函数：将用户输入的列表名称保存到浏览器本地存储中
 * 保存点就是 'customListName' 这个 key
 * chrome.storage.local.set 方法会把数据存储在用户本地的浏览器中
 */
async function saveCustomListName(name) {
  await chrome.storage?.local?.set({ customListName: name });
}

/**
 * 页面加载完成后，进行初始化操作
 * 设置语言、占位提示文本、默认值、绑定事件等
 */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 设置 HTML 元素的文本内容，使用对应语言包
    document.getElementById("title").textContent = langPack.title;
    document.getElementById("label").textContent = langPack.label;
    document.getElementById("markButton").textContent = langPack.button;
    document.getElementById("hint").innerHTML = langPack.hintHtml;
    document.getElementById("postcodes").placeholder = langPack.placeholder;

    document.getElementById("customListLabel").textContent =
      langPack.customListLabel;
    document.getElementById("copyIcon").textContent = langPack.copyIcon;

    // 获取输入框 DOM 元素
    const customListInput = document.getElementById("customListName");
    // 从本地存储读取保存的列表名称，并赋值给输入框
    customListInput.value = await getCustomListName();

    console.log("customListInput.value", customListInput.value);

    // 同时更新复制按钮旁边显示的名称（用于复制）
    document
      .getElementById("copyableListName")
      .querySelector("span:first-child").textContent = customListInput.value;

    // 监听输入变化并保存
    customListInput.addEventListener("input", async (e) => {
      const newListName = e.target.value;
      // 保存到本地存储
      await saveCustomListName(newListName);
      // 更新复制按钮旁边显示的名称
      document
        .getElementById("copyableListName")
        .querySelector("span:first-child").textContent = newListName;
      // 更新当前使用的列表名称
      window.currentListName = newListName;
    });

    // 设置页面语言
    document.documentElement.lang = isChinese ? "zh" : "en";

    // 设置页面标题
    document.title = langPack.title;
    // 点击复制按钮，复制列表名称到剪贴板
    const copyIcon = document.getElementById("copyIcon");
    copyIcon.addEventListener("click", async () => {
      console.log("点击了复制按钮");
      try {
        const listName = document.getElementById("customListName").value;
        await navigator.clipboard.writeText(listName); // 使用浏览器 API 复制文本

        const originalText = copyIcon.textContent;
        copyIcon.textContent = langPack.copied;
        document.getElementById("copyableListName").style.borderColor =
          "#4CAF50";
        setTimeout(() => {
          copyIcon.textContent = originalText;
          document.getElementById("copyableListName").style.borderColor =
            "#ccc";
        }, 1500);
      } catch (err) {
        alert(`${langPack.errorPrefix} ${err.message || err}`);
      }
    });
  } catch (error) {
    console.error(langPack.initFailed, error);
  }
});

// 获取用户保存的列表（在页面上下文中执行）
function extractUserLists() {
  return new Promise((resolve) => {
    const savedButton = document.querySelector(
      'button[aria-label="已保存"], button[aria-label="Saved"]'
    );
    if (!savedButton) return resolve([]);

    savedButton.click();
    setTimeout(() => {
      const listElements = document.querySelectorAll('div[role="listitem"]');
      const lists = Array.from(listElements)
        .map((el) => {
          const title = el.querySelector('div[role="heading"]');
          return title ? { name: title.textContent.trim() } : null;
        })
        .filter(Boolean);

      resolve(lists);
    }, 2000);
  });
}

// 点击"标注"按钮
document.getElementById("markButton").addEventListener("click", async () => {
  const postcodeInput = document.getElementById("postcodes").value.trim();
  const status = document.getElementById("status");

  if (!postcodeInput) {
    status.textContent = langPack.inputPlaceholder;
    status.className = "status error";
    status.style.display = "block";
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const url = tab.url || "";

    if (!url.includes("google.com") || !url.includes("/maps")) {
      status.textContent = langPack.useOnMapsError;
      status.className = "status error";
      status.style.display = "block";
      return;
    }

    status.textContent = langPack.processingStatus;
    status.className = "status processing";
    status.style.display = "block";

    // 使用最新的列表名称
    const customListName = document.getElementById("customListName").value;

    // Create a serializable copy of only the language strings we need
    const contentLang = {
      waitElementTimeout: langPack.waitElementTimeout,
      skipPostcode: langPack.skipPostcode,
      postcodeAlreadySaved: langPack.postcodeAlreadySaved,
      postcodeMarked: langPack.postcodeMarked,
      postcodeMarkFailed: langPack.postcodeMarkFailed,
      postcodePlaceholder: langPack.postcodePlaceholder,
    };

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: markPostcodes,
      args: [postcodeInput, contentLang, customListName],
    });

    status.textContent = langPack.completeStatus;
    status.className = "status complete";
    status.style.display = "block";

    // 3秒后隐藏状态消息
    setTimeout(() => {
      status.textContent = "";
      status.className = "status";
      status.style.display = "none";
    }, 3000);
  } catch (error) {
    console.error(langPack.markFailed, error);
    status.textContent = langPack.errorPrefix + error.message;
    status.className = "status error";
    status.style.display = "block";
  }
});

// 页面上下文中执行，处理邮编标注
function markPostcodes(input, lang, targetListName) {
  // 解析用户输入
  function parsePostcodes(str) {
    const postcodes = [];
    str
      .replace(/[、，]/g, ",")
      .split(",")
      .forEach((part) => {
        const trimmed = part.trim();
        if (trimmed.includes("至")) {
          const [start, end] = trimmed
            .split("至")
            .map((n) => parseInt(n.trim()));
          for (let i = start; i <= end; i++) postcodes.push(i);
        } else {
          const num = parseInt(trimmed);
          if (!isNaN(num)) postcodes.push(num);
        }
      });
    return postcodes;
  }

  // 等待页面元素加载
  function waitFor(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeout)
          return reject(
            new Error(lang.waitElementTimeout.replace("%s", selector))
          );
        setTimeout(check, 100);
      })();
    });
  }

  // 搜索并标注单个邮编
  async function handlePostcode(postcode) {
    try {
      const inputBox = await waitFor('input[name="q"]');
      inputBox.value = lang.postcodePlaceholder.replace("%s", postcode);
      inputBox.dispatchEvent(new Event("input", { bubbles: true }));

      const searchBtn = await waitFor(
        'button[aria-label="搜索"], button[aria-label="Search"]'
      );
      searchBtn.click();

      await new Promise((r) => setTimeout(r, 2000));

      const saveBtn = document.querySelector(
        'button[aria-label="保存"], button[aria-label="Save"], button[aria-label="已保存"], button[aria-label="Saved"]'
      );
      if (!saveBtn) {
        console.log(lang.skipPostcode.replace("%s", postcode));
        return;
      }

      // if (saveBtn.textContent.includes("已保存")) {
      //   console.log(lang.postcodeAlreadySaved.replace("%s", postcode));
      //   return;
      // }

      saveBtn.click();
      await new Promise((r) => setTimeout(r, 1500));

      const items = document.querySelectorAll('div[role="menuitemradio"]');

      for (const item of items) {
        const label = item.querySelector(".mLuXec")?.textContent;
        if (label?.includes(targetListName)) {
          if (item.getAttribute("aria-checked") !== "true") item.click();
          break;
        }
      }

      const doneBtn = await waitFor(
        'button[aria-label="已保存"], button[aria-label="Saved"]'
      );
      doneBtn.click();
      console.log(lang.postcodeMarked.replace("%s", postcode));
    } catch (err) {
      console.warn(lang.postcodeMarkFailed.replace("%s", postcode), err);
    }
  }

  // 批量执行标注
  (async () => {
    const postcodes = parsePostcodes(input);
    for (const code of postcodes) {
      await handlePostcode(code);
    }
  })();
}
