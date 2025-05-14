// 页面加载完成后初始化列表
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab.url.includes("google.com/maps")) {
      await loadUserLists(tab.id);
    }
  } catch (error) {
    console.error("初始化失败:", error);
  }
});

// 加载保存地点列表
async function loadUserLists(tabId) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      function: extractUserLists,
    });

    const lists = result[0].result || [];
    const select = document.getElementById("listSelect");
    select.innerHTML = "";

    if (lists.length > 0) {
      lists.forEach(({ name }) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
      });
    } else {
      const option = document.createElement("option");
      option.textContent = "没有找到可用的列表";
      option.disabled = true;
      select.appendChild(option);
    }
  } catch (error) {
    console.error("加载用户列表失败:", error);
  }
}

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

// 点击“标注”按钮
document.getElementById("markButton").addEventListener("click", async () => {
  const postcodeInput = document.getElementById("postcodes").value.trim();
  const status = document.getElementById("status");

  if (!postcodeInput) {
    status.textContent = "请输入邮编";
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const url = tab.url || "";

    if (!url.includes("google.com/maps")) {
      status.textContent = "请在谷歌地图页面使用此扩展";
      return;
    }

    status.textContent = "正在处理...";
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: markPostcodes,
      args: [postcodeInput],
    });

    status.textContent = "处理完成";
  } catch (error) {
    console.error("标注失败:", error);
    status.textContent = "发生错误：" + error.message;
  }
});

// 页面上下文中执行，处理邮编标注
function markPostcodes(input) {
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
          return reject(new Error(`等待元素 ${selector} 超时`));
        setTimeout(check, 100);
      })();
    });
  }

  // 搜索并标注单个邮编
  async function handlePostcode(postcode) {
    try {
      const inputBox = await waitFor('input[name="q"]');
      inputBox.value = `邮政编码: ${postcode}, Australia`;
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
        console.log(`未找到保存按钮，跳过邮编 ${postcode}`);
        return;
      }

      if (saveBtn.textContent.includes("已保存")) {
        console.log(`邮编 ${postcode} 已经保存，跳过`);
        return;
      }

      saveBtn.click();
      await new Promise((r) => setTimeout(r, 1500));

      const targetLabel = "🦘澳洲whv农场肉场建筑等集签点";
      const items = document.querySelectorAll('div[role="menuitemradio"]');

      for (const item of items) {
        const label = item.querySelector(".mLuXec")?.textContent;
        if (label?.includes(targetLabel)) {
          if (item.getAttribute("aria-checked") !== "true") item.click();
          break;
        }
      }

      const doneBtn = await waitFor(
        'button[aria-label="已保存"], button[aria-label="Saved"]'
      );
      doneBtn.click();
      console.log(`已标注邮编: ${postcode}`);
    } catch (err) {
      console.warn(`标注邮编 ${postcode} 失败:`, err);
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
