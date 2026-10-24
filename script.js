const $ = (selector) => document.querySelector(selector);

const userText = $("#userText");
const analyzeButton = $("#analyzeButton");
const clearButton = $("#clearButton");
const errorMessage = $("#errorMessage");
const results = $("#results");
const charCount = $("#charCount");

userText.addEventListener("input", () => {
  charCount.textContent = `${userText.value.length.toLocaleString("vi-VN")} ký tự`;
  errorMessage.hidden = true;
});

clearButton.addEventListener("click", () => {
  userText.value = "";
  charCount.textContent = "0 ký tự";
  errorMessage.hidden = true;
  userText.focus();
});

analyzeButton.addEventListener("click", analyzeWriting);

$("#copyCorrected").addEventListener("click", async () => {
  const text = $("#correctedText").textContent;
  try {
    await navigator.clipboard.writeText(text);
    $("#copyCorrected").textContent = "Đã sao chép ✓";
    setTimeout(() => { $("#copyCorrected").textContent = "Sao chép bản sửa"; }, 1800);
  } catch {
    showError("Trình duyệt không cho phép sao chép tự động. Bạn hãy bôi đen bản sửa và sao chép thủ công.");
  }
});

async function analyzeWriting() {
  const text = userText.value.trim();
  if (!text) {
    showError("Bạn hãy nhập đoạn văn tiếng Anh trước khi phân tích nhé.");
    userText.focus();
    return;
  }

  setLoading(true);
  errorMessage.hidden = true;

  try {
    /*
      Bảo mật: không đặt Gemini API key trong script.js.
      Endpoint /api/analyze cần được tạo ở phía máy chủ (Vercel Serverless Function).
      Endpoint nhận { text, styleTarget, targetLevel } và trả về JSON theo cấu trúc
      corrected_text, overall_feedback, corrections, advanced_rephrasing, vocabulary_bank.
    */
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        styleTarget: $("#styleTarget").value,
        targetLevel: $("#targetLevel").value
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Không thể phân tích bài viết. Hãy kiểm tra cấu hình máy chủ.");
    }

    renderResults(text, data);
    results.hidden = false;
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if (error instanceof TypeError) {
      showError("Chưa kết nối được máy chủ AI. Giao diện đã sẵn sàng, nhưng cần tạo endpoint /api/analyze và thêm GEMINI_API_KEY trong Environment Variables của Vercel.");
    } else {
      showError(error.message || "Đã xảy ra lỗi khi phân tích. Vui lòng thử lại.");
    }
  } finally {
    setLoading(false);
  }
}

function renderResults(original, data) {
  $("#originalText").textContent = original;
  $("#correctedText").textContent = data.corrected_text || "Chưa có bản sửa.";
  $("#overallFeedback").textContent = data.overall_feedback || "Chưa có nhận xét.";

  const correctionsList = $("#correctionsList");
  correctionsList.replaceChildren();
  const corrections = Array.isArray(data.corrections) ? data.corrections : [];
  if (!corrections.length) {
    correctionsList.append(createNotice("Không có lỗi cụ thể nào được trả về."));
  } else {
    corrections.forEach((item) => {
      const card = document.createElement("div");
      card.className = "correction-item";
      const top = document.createElement("div");
      top.className = "correction-pair";
      top.append(
        makeText("span", item.original || "", "original-phrase"),
        makeText("span", "→", "pair-arrow"),
        makeText("span", item.correction || "", "corrected-phrase")
      );
      card.append(top);
      if (item.type) card.append(makeText("span", item.type, "type-tag"));
      if (item.explanation) card.append(makeText("p", item.explanation, "explanation"));
      correctionsList.append(card);
    });
  }

  const rephrasingList = $("#rephrasingList");
  rephrasingList.replaceChildren();
  const alternatives = Array.isArray(data.advanced_rephrasing) ? data.advanced_rephrasing : [];
  if (!alternatives.length) rephrasingList.append(createNotice("Chưa có gợi ý viết lại."));
  alternatives.forEach((value, index) => {
    const item = document.createElement("div");
    item.className = "rephrasing-item";
    item.append(makeText("span", `Cách ${index + 1}`, "type-tag"));
    item.append(makeText("p", value, "result-text"));
    rephrasingList.append(item);
  });

  const vocabularyList = $("#vocabularyList");
  vocabularyList.replaceChildren();
  const words = Array.isArray(data.vocabulary_bank) ? data.vocabulary_bank : [];
  if (!words.length) {
    const row = document.createElement("tr");
    const cell = makeText("td", "Chưa có từ vựng được gợi ý.", "");
    cell.colSpan = 4;
    row.append(cell);
    vocabularyList.append(row);
  } else {
    words.forEach((word) => {
      const row = document.createElement("tr");
      [word.word, word.ipa, word.meaning_vi, word.example].forEach((value) => {
        row.append(makeText("td", value || "—", ""));
      });
      vocabularyList.append(row);
    });
  }
}

function makeText(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function createNotice(text) {
  return makeText("p", text, "empty-state");
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function setLoading(isLoading) {
  analyzeButton.disabled = isLoading;
  analyzeButton.innerHTML = isLoading
    ? '<span class="spinner" aria-hidden="true"></span> Đang phân tích...'
    : '<span>✨</span> Phân tích & sửa bài <span class="button-arrow">→</span>';
}
