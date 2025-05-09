// 页面加载时获取用户的列表
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
    console.error("加载列表失败:", error);
  }
});

// 加载用户的列表
async function loadUserLists(tabId) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      function: getUserLists,
    });

    const lists = result[0].result;
    const listSelect = document.getElementById("listSelect");

    // 清空现有选项
    listSelect.innerHTML = "";

    if (lists.length > 0) {
      lists.forEach((list) => {
        const option = document.createElement("option");
        option.value = list.name;
        option.textContent = list.name;
        listSelect.appendChild(option);
      });
    } else {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "没有找到可用的列表";
      listSelect.appendChild(option);
    }
  } catch (error) {
    console.error("加载列表失败:", error);
  }
}

// 获取用户的列表
function getUserLists() {
  return new Promise((resolve) => {
    // 点击"已保存"按钮
    const savedButton = document.querySelector(
      'button[aria-label="已保存"], button[aria-label="Saved"]'
    );
    if (savedButton) {
      savedButton.click();

      // 等待列表加载
      setTimeout(() => {
        const listItems = document.querySelectorAll('div[role="listitem"]');
        const lists = Array.from(listItems)
          .map((item) => {
            const nameElement = item.querySelector('div[role="heading"]');
            return nameElement
              ? { name: nameElement.textContent.trim() }
              : null;
          })
          .filter((item) => item !== null);

        resolve(lists);
      }, 2000);
    } else {
      resolve([]);
    }
  });
}

document.getElementById("markButton").addEventListener("click", async () => {
  const postcodes = document.getElementById("postcodes").value;
  const status = document.getElementById("status");

  if (!postcodes.trim()) {
    status.textContent = "请输入邮编";
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab.url.includes("google.com/maps")) {
      status.textContent = "请在谷歌地图页面使用此扩展";
      return;
    }

    status.textContent = "正在处理...";

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: markPostcodes,
      args: [postcodes],
    });

    status.textContent = "处理完成";
  } catch (error) {
    status.textContent = "发生错误：" + error.message;
  }
});

// 在地图上标注邮编的函数
function markPostcodes(postcodeStr) {
  // 解析邮编字符串
  function parsePostcodes(str) {
    const postcodes = [];
    const parts = str.replace(/[、，]/g, ",").split(",");

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes("至")) {
        const [start, end] = trimmed.split("至").map((n) => parseInt(n.trim()));
        for (let i = start; i <= end; i++) {
          postcodes.push(i);
        }
      } else {
        const num = parseInt(trimmed);
        if (!isNaN(num)) {
          postcodes.push(num);
        }
      }
    }
    return postcodes;
  }

  // 等待元素出现
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkElement = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`等待元素 ${selector} 超时`));
        } else {
          setTimeout(checkElement, 100);
        }
      };
      checkElement();
    });
  }

  // 检查是否找到结果
  async function checkSearchResults() {
    try {
      // 等待一段时间让结果加载
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 检查是否有搜索结果
      const results = document.querySelectorAll('div[role="article"]');
      console.log("搜索结果数量:", results.length);

      if (results.length > 0) {
        console.log("找到搜索结果");
        return true;
      }

      // 检查是否有"未找到结果"的提示
      const mainContent = document.querySelector('div[role="main"]');
      if (mainContent) {
        const text = mainContent.textContent;
        console.log("主内容区域文本:", text);
        if (text.includes("未找到结果") || text.includes("No results found")) {
          console.log("明确提示未找到结果");
          return false;
        }
      }

      // 如果没有明确的"未找到结果"提示，再等待一下看是否有结果出现
      console.log("等待额外时间检查结果...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const resultsAfterWait = document.querySelectorAll('div[role="article"]');
      console.log("额外等待后的搜索结果数量:", resultsAfterWait.length);

      // 如果没有找到结果，但也没有明确的"未找到结果"提示，再检查一下是否有其他类型的结果
      if (resultsAfterWait.length === 0) {
        const anyResults = document.querySelectorAll('div[role="button"]');
        console.log("其他类型的结果数量:", anyResults.length);
        return anyResults.length > 0;
      }

      return resultsAfterWait.length > 0;
    } catch (error) {
      console.error("检查搜索结果失败:", error);
      return false;
    }
  }

  // 检查位置是否已经标注
  async function isLocationMarked(postcode) {
    try {
      // 获取搜索框
      const searchBox = await waitForElement('input[name="q"]');

      // 输入搜索内容
      searchBox.value = `邮政编码: ${postcode}, Australia`;
      searchBox.dispatchEvent(new Event("input", { bubbles: true }));

      // 点击搜索按钮
      const searchButton = await waitForElement(
        'button[aria-label="搜索"], button[aria-label="Search"]'
      );
      searchButton.click();

      // 等待搜索结果
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 检查是否有"已保存"按钮
      const saveButton = document.querySelector(
        'button[aria-label="已保存"], button[aria-label="Saved"]'
      );

      // 如果按钮显示"已保存"，说明已经保存过了
      if (saveButton && saveButton.textContent.includes("已保存")) {
        console.log(`邮编 ${postcode} 已经标注过，跳过`);
        return true;
      }

      // 如果按钮显示"保存"，则检查是否已经保存到目标列表
      if (saveButton) {
        // 点击保存按钮查看是否已保存
        saveButton.click();
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 检查是否已经保存到目标列表
        const listItems = document.querySelectorAll(
          'div[role="menuitemradio"]'
        );
        for (const item of listItems) {
          const label = item.querySelector(".mLuXec")?.textContent;
          if (label && label.includes("🦘澳洲whv集签点")) {
            if (item.getAttribute("aria-checked") === "true") {
              // 如果已保存，关闭对话框
              const doneButton = await waitForElement(
                'button[aria-label="已保存"], button[aria-label="Done"]'
              );
              doneButton.click();
              return true;
            }
            break;
          }
        }

        // 如果未保存到目标列表，关闭对话框
        const doneButton = await waitForElement(
          'button[aria-label="已保存"], button[aria-label="Done"]'
        );
        doneButton.click();
      }

      return false;
    } catch (error) {
      console.error(`检查位置 ${postcode} 是否已标注时出错:`, error);
      return false;
    }
  }

  // 在地图上搜索并标记位置
  async function searchAndMark(postcode) {
    try {
      // 先检查是否已经标注
      const isMarked = await isLocationMarked(postcode);
      if (isMarked) {
        console.log(`邮编 ${postcode} 已经标注过，跳过`);
        return true;
      }

      // 检查是否找到结果
      const hasResults = await checkSearchResults();
      if (!hasResults) {
        console.log(`未找到邮编 ${postcode} 的结果`);
        return false;
      }

      // 点击第一个搜索结果
      const firstResult = await waitForElement('div[role="article"]');
      firstResult.click();

      // 等待位置信息加载
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 保存到目标列表
      await saveToTargetList();

      return true;
    } catch (error) {
      console.error(`处理邮编 ${postcode} 时出错:`, error);
      return false;
    }
  }

  // 保存到指定列表
  async function saveToTargetList() {
    try {
      // 点击"保存"按钮
      const saveButton = await waitForElement(
        'button[aria-label="保存"], button[aria-label="Save"]'
      );
      saveButton.click();

      // 等待保存对话框加载
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 检查是否已经保存到目标列表
      const checkboxes = document.querySelectorAll('div[role="checkbox"]');
      let alreadySaved = false;
      let targetCheckbox = null;

      for (const checkbox of checkboxes) {
        const label = checkbox.getAttribute("aria-label");
        if (label && label.includes("🦘澳洲whv集签点")) {
          targetCheckbox = checkbox;
          if (checkbox.getAttribute("aria-checked") === "true") {
            alreadySaved = true;
          }
          break;
        }
      }

      if (alreadySaved) {
        // 如果已经保存，直接点击"完成"按钮
        const doneButton = await waitForElement(
          'button[aria-label="已保存"], button[aria-label="Done"]'
        );
        doneButton.click();
        return true;
      }

      // 如果未保存，点击目标列表的复选框
      if (targetCheckbox) {
        targetCheckbox.click();
      }

      // 点击"完成"按钮
      const doneButton = await waitForElement(
        'button[aria-label="已保存"], button[aria-label="Done"]'
      );
      doneButton.click();

      return true;
    } catch (error) {
      console.error("保存到列表失败:", error);
      return false;
    }
  }

  // 主函数
  async function main() {
    const postcodes = parsePostcodes(postcodeStr);
    console.log(`找到 ${postcodes.length} 个邮编`);

    if (postcodes.length === 0) return;

    const notFoundPostcodes = [];

    // 处理所有邮编
    for (const postcode of postcodes) {
      const success = await searchAndMark(postcode);
      if (!success) {
        notFoundPostcodes.push(postcode);
      }
      // 等待一下再处理下一个邮编
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 如果有未找到的邮编，显示在控制台
    if (notFoundPostcodes.length > 0) {
      console.log("以下邮编未找到结果：", notFoundPostcodes.join(", "));
    }
  }

  main();
}
