(function () {
  const STORAGE_KEY = "money-flow-core-v1";
  const APP_NAME = "Money Flow";

  const ACCOUNT_SUBTYPES = [
    { key: "checking", label: "Checking" },
    { key: "installment_expense", label: "Installment (Expense)" },
    { key: "investment", label: "Investment" },
    { key: "pension", label: "Pension" },
    { key: "installment_saving", label: "Installment (Saving)" },
  ];

  const ACCOUNT_SUBTYPE_ORDER = ACCOUNT_SUBTYPES.reduce((acc, item, index) => {
    acc[item.key] = index;
    return acc;
  }, {});

  const ACCOUNT_PROVIDERS = [
    "Kyongnam Bank",
    "Kwangju Bank",
    "Kookmin Bank",
    "Industrial Bank of Korea",
    "Nonghyup Bank",
    "Daegu Bank",
    "Busan Bank",
    "Suhyup Bank",
    "Shinhan Bank",
    "Woori Bank",
    "Jeonbuk Bank",
    "SC First Bank",
    "Jeju Bank",
    "Hana Bank",
    "Korea Development Bank",
    "Export-Import Bank of Korea",
    "Citibank Korea",
    "K Bank",
    "Toss Bank",
    "KEB Hana Bank",
    "Kakao Bank",
    "Hi Investment & Securities",
    "SK Securities",
    "Kyobo Securities",
    "Shinhan Investment",
    "Daishin Securities",
    "Mirae Asset",
    "Hana Financial Investment",
    "DB Financial Investment",
    "Yuanta Securities",
    "Leading Investment",
    "Meritz Securities",
    "Bookook Securities",
    "Samsung Securities",
    "Eugene Investment",
    "NH Investment",
    "Shinyoung Securities",
    "Yuhwa Securities",
    "Kiwoom Securities",
    "Hanwha Investment",
    "Korea Investment",
    "KB Securities",
    "Hanyang Securities",
  ];

  const CARD_PROVIDERS = [
    "Samsung Card",
    "Hyundai Card",
    "KB Kookmin Card",
    "Shinhan Card",
    "BC Card",
    "Hana Card",
    "Lotte Card",
    "Woori Card",
    "Toss Bank",
    "Kakao Bank",
    "K Bank",
    "Travel Wallet",
  ];

  const TYPE_LABEL = {
    salary_account: "Salary",
    asset_account: "Account",
    payment_instrument: "Card",
    expense_category: "Expense",
  };

  const state = loadState();
  let confirmHandler = null;
  let toastTimer = null;

  ensureSalaryNode();
  render();
  window.addEventListener("resize", renderGraphOnly);

  function defaultState() {
    return {
      introSeen: false,
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      connectSourceId: null,
      form: {
        type: "asset_account",
        subtype: "checking",
        provider: "",
        name: "",
        note: "",
      },
      confirmMessage: null,
      toast: "",
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        ...defaultState(),
        ...parsed,
        form: { ...defaultState().form, ...(parsed.form || {}) },
      };
    } catch (_) {
      return defaultState();
    }
  }

  function ensureSalaryNode() {
    const hasSalary = state.nodes.some((n) => n.type === "salary_account");
    if (hasSalary) return;
    state.nodes.push({
      id: "salary-fixed",
      type: "salary_account",
      subtype: null,
      provider: "Salary Account",
      name: "Salary Account",
      note: "",
      locked: true,
      createdAt: Date.now(),
    });
    persist();
  }

  function persist() {
    const payload = {
      introSeen: state.introSeen,
      nodes: state.nodes,
      edges: state.edges,
      form: state.form,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function setToast(message) {
    state.toast = message;
    renderToast();
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      state.toast = "";
      renderToast();
    }, 1800);
  }

  function openConfirm(message, onConfirm) {
    state.confirmMessage = message;
    confirmHandler = onConfirm;
    renderConfirm();
  }

  function closeConfirm() {
    state.confirmMessage = null;
    confirmHandler = null;
    renderConfirm();
  }

  function getNodesByType(type) {
    return state.nodes.filter((node) => node.type === type);
  }

  function subtypeLabel(key) {
    const found = ACCOUNT_SUBTYPES.find((item) => item.key === key);
    return found ? found.label : "";
  }

  function sanitizeForm(form) {
    return {
      type: form.type,
      subtype: form.subtype || "checking",
      provider: (form.provider || "").trim(),
      name: (form.name || "").trim().slice(0, 30),
      note: (form.note || "").trim().slice(0, 40),
    };
  }

  function getProviderDataset(type) {
    if (type === "asset_account") return ACCOUNT_PROVIDERS;
    if (type === "payment_instrument") return CARD_PROVIDERS;
    return [];
  }

  function validateNodeInput(form, editingNode) {
    if (!form.name) return "Name is required.";
    if (form.name.length > 30) return "Name must be 30 chars or less.";
    if (form.note.length > 40) return "Memo must be 40 chars or less.";

    if (!editingNode || editingNode.type !== form.type) {
      if (form.type === "asset_account" && getNodesByType("asset_account").length >= 7) {
        return "Accounts are limited to 7.";
      }
      if (
        form.type === "payment_instrument" &&
        getNodesByType("payment_instrument").length >= 5
      ) {
        return "Cards are limited to 5.";
      }
      if (form.type === "expense_category" && getNodesByType("expense_category").length >= 14) {
        return "Expense categories are limited to 14.";
      }
    }

    return null;
  }

  function isAllowedConnection(fromType, toType) {
    if (fromType === "salary_account") {
      return (
        toType === "asset_account" ||
        toType === "payment_instrument" ||
        toType === "expense_category"
      );
    }
    if (fromType === "asset_account") {
      return (
        toType === "asset_account" ||
        toType === "payment_instrument" ||
        toType === "expense_category"
      );
    }
    if (fromType === "payment_instrument") {
      return toType === "expense_category";
    }
    return false;
  }

  function clearSelections() {
    state.selectedNodeId = null;
    state.selectedEdgeId = null;
    state.connectSourceId = null;
  }

  function sortedAssetAccounts(nodes) {
    return nodes
      .slice()
      .sort((a, b) => {
        const oa = ACCOUNT_SUBTYPE_ORDER[a.subtype] ?? 99;
        const ob = ACCOUNT_SUBTYPE_ORDER[b.subtype] ?? 99;
        if (oa !== ob) return oa - ob;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
  }

  function createNodeId() {
    return "node-" + Math.random().toString(36).slice(2, 10);
  }

  function buildShareText() {
    const assets = sortedAssetAccounts(getNodesByType("asset_account"));
    const cards = getNodesByType("payment_instrument");
    const expenses = getNodesByType("expense_category");

    const lines = [];
    lines.push(`[${APP_NAME}] Money Flow Map`);
    lines.push(`Accounts ${assets.length} / Cards ${cards.length} / Expenses ${expenses.length}`);
    lines.push("");
    lines.push("Nodes");
    state.nodes.forEach((n) => {
      const extra = n.type === "asset_account" ? ` (${subtypeLabel(n.subtype)})` : "";
      lines.push(`- ${TYPE_LABEL[n.type]}: ${n.name}${extra}`);
    });
    lines.push("");
    lines.push("Edges");
    if (!state.edges.length) {
      lines.push("- none");
    } else {
      state.edges.forEach((edge) => {
        const from = state.nodes.find((n) => n.id === edge.from);
        const to = state.nodes.find((n) => n.id === edge.to);
        if (from && to) lines.push(`- ${from.name} -> ${to.name}`);
      });
    }
    return lines.join("\n");
  }

  async function tryTossShare(text) {
    const tossCandidates = [
      window.Toss,
      window.toss,
      window.AppsInToss,
      window.appsInToss,
      window.TossWebBridge,
    ].filter(Boolean);

    for (const toss of tossCandidates) {
      if (typeof toss.shareText === "function") {
        await toss.shareText(text);
        return true;
      }
      if (typeof toss.share === "function") {
        await toss.share({ text: text, title: APP_NAME });
        return true;
      }
    }
    return false;
  }

  async function fallbackClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  }

  async function handleShare() {
    const text = buildShareText();

    try {
      const tossDone = await tryTossShare(text);
      if (tossDone) {
        setToast("Shared via Toss API.");
        return;
      }
    } catch (_) {
      /* ignore and fallback */
    }

    try {
      if (navigator.share) {
        await navigator.share({ title: APP_NAME, text });
        setToast("Shared via Web Share.");
        return;
      }
    } catch (_) {
      /* ignore and fallback */
    }

    try {
      const copied = await fallbackClipboard(text);
      if (copied) {
        setToast("Copied to clipboard.");
        return;
      }
    } catch (_) {
      /* continue */
    }

    setToast("Sharing failed.");
  }

  function layoutNodes(canvasRect) {
    const width = canvasRect.width;
    const height = canvasRect.height;
    const positions = {};

    const salary = state.nodes.find((n) => n.type === "salary_account");
    if (salary) {
      positions[salary.id] = { x: width * 0.5, y: height * 0.14 };
    }

    const assets = sortedAssetAccounts(getNodesByType("asset_account"));
    const cards = getNodesByType("payment_instrument").sort(
      (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
    );
    const expenses = getNodesByType("expense_category").sort(
      (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
    );

    placeRow(assets, height * 0.36, width, positions);
    placeRow(cards, height * 0.56, width, positions);

    if (expenses.length <= 7) {
      placeRow(expenses, height * 0.76, width, positions);
    } else {
      placeRow(expenses.slice(0, 7), height * 0.73, width, positions);
      placeRow(expenses.slice(7), height * 0.87, width, positions);
    }

    return positions;
  }

  function placeRow(items, y, width, positions) {
    if (!items.length) return;
    if (items.length === 1) {
      positions[items[0].id] = { x: width / 2, y };
      return;
    }
    const sidePadding = Math.max(48, width * 0.08);
    const usable = width - sidePadding * 2;
    const rawGap = usable / (items.length - 1);
    const gap = Math.min(110, Math.max(42, rawGap));
    const rowWidth = gap * (items.length - 1);
    let startX = width / 2 - rowWidth / 2;
    if (startX < sidePadding) startX = sidePadding;
    for (let i = 0; i < items.length; i += 1) {
      positions[items[i].id] = { x: startX + i * gap, y };
    }
  }

  function render() {
    const app = document.getElementById("app");
    if (!state.introSeen) {
      app.innerHTML = `
        <section class="screen intro">
          <div class="intro-card">
            <h1 class="intro-title">Money Flow</h1>
            <p class="intro-desc">Visualize your money flow from salary account in one mobile screen.</p>
          </div>
          <button class="btn btn-primary" id="startBtn">Start</button>
        </section>
      `;
      document.getElementById("startBtn").addEventListener("click", () => {
        state.introSeen = true;
        persist();
        render();
      });
      return;
    }

    const currentNode = state.nodes.find((n) => n.id === state.selectedNodeId) || null;
    if (currentNode && currentNode.type !== "salary_account") {
      state.form = {
        type: currentNode.type,
        subtype: currentNode.subtype || "checking",
        provider: currentNode.provider || "",
        name: currentNode.name || "",
        note: currentNode.note || "",
      };
    }

    const providerOptions = getProviderDataset(state.form.type);
    const providerListId = "providerOptions";
    const edgeSelected = !!state.selectedEdgeId;
    const canUpdate = !!currentNode && currentNode.type !== "salary_account";
    const statusText = `Accounts ${getNodesByType("asset_account").length}/7 | Cards ${getNodesByType(
      "payment_instrument"
    ).length}/5 | Expenses ${getNodesByType("expense_category").length}/14`;

    app.innerHTML = `
      <section class="screen main">
        <div class="toolbar">
          <button class="btn btn-weak" id="shareBtn">Share</button>
          <button class="btn btn-weak ${edgeSelected ? "" : "hidden"}" id="deleteEdgeBtn">Disconnect Edge</button>
          <button class="btn btn-danger" id="resetBtn">Reset All</button>
          <span class="status">${statusText}</span>
        </div>

        <div class="canvas-wrap" id="canvasWrap">
          <svg id="edgeLayer"></svg>
          <div class="node-layer" id="nodeLayer"></div>
        </div>

        <div class="panel">
          <div class="panel-grid">
            <div class="field">
              <label for="typeSelect">Node Type</label>
              <select id="typeSelect">
                <option value="asset_account" ${
                  state.form.type === "asset_account" ? "selected" : ""
                }>Account</option>
                <option value="payment_instrument" ${
                  state.form.type === "payment_instrument" ? "selected" : ""
                }>Card</option>
                <option value="expense_category" ${
                  state.form.type === "expense_category" ? "selected" : ""
                }>Expense</option>
              </select>
            </div>

            <div class="field ${state.form.type === "asset_account" ? "" : "hidden"}" id="subtypeField">
              <label for="subtypeSelect">Account Subtype</label>
              <select id="subtypeSelect">
                ${ACCOUNT_SUBTYPES.map(
                  (item) =>
                    `<option value="${item.key}" ${
                      state.form.subtype === item.key ? "selected" : ""
                    }>${item.label}</option>`
                ).join("")}
              </select>
            </div>

            <div class="field full">
              <label for="providerInput">Provider</label>
              <input id="providerInput" list="${providerListId}" maxlength="30" value="${escapeHtml(
                state.form.provider
              )}" placeholder="Choose or type provider" />
              <datalist id="${providerListId}">
                ${providerOptions.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("")}
              </datalist>
            </div>

            <div class="field">
              <label for="nameInput">Node Name (max 30)</label>
              <input id="nameInput" maxlength="30" value="${escapeHtml(state.form.name)}" />
            </div>

            <div class="field">
              <label for="noteInput">Memo (max 40)</label>
              <textarea id="noteInput" maxlength="40">${escapeHtml(state.form.note)}</textarea>
            </div>

            <div class="actions full">
              <button class="btn btn-primary" id="addBtn">Add</button>
              <button class="btn btn-weak ${canUpdate ? "" : "hidden"}" id="updateBtn">Update</button>
              <button class="btn btn-danger ${canUpdate ? "" : "hidden"}" id="deleteNodeBtn">Delete</button>
            </div>
          </div>
          <div class="helper">
            Click a source node and then a target node to create edge.
          </div>
        </div>
      </section>
      <div class="toast" id="toast"></div>
      <div id="confirmRoot"></div>
    `;

    bindMainEvents();
    renderGraphOnly();
    renderToast();
    renderConfirm();
  }

  function bindMainEvents() {
    const typeSelect = document.getElementById("typeSelect");
    const subtypeSelect = document.getElementById("subtypeSelect");
    const providerInput = document.getElementById("providerInput");
    const nameInput = document.getElementById("nameInput");
    const noteInput = document.getElementById("noteInput");
    const addBtn = document.getElementById("addBtn");
    const updateBtn = document.getElementById("updateBtn");
    const deleteNodeBtn = document.getElementById("deleteNodeBtn");
    const deleteEdgeBtn = document.getElementById("deleteEdgeBtn");
    const resetBtn = document.getElementById("resetBtn");
    const shareBtn = document.getElementById("shareBtn");

    if (typeSelect) {
      typeSelect.addEventListener("change", (e) => {
        state.form.type = e.target.value;
        if (state.form.type !== "asset_account") state.form.subtype = "checking";
        render();
      });
    }

    if (subtypeSelect) {
      subtypeSelect.addEventListener("change", (e) => {
        state.form.subtype = e.target.value;
        persist();
      });
    }

    if (providerInput) {
      providerInput.addEventListener("input", (e) => {
        state.form.provider = e.target.value.slice(0, 30);
      });
    }

    if (nameInput) {
      nameInput.addEventListener("input", (e) => {
        state.form.name = e.target.value.slice(0, 30);
      });
    }

    if (noteInput) {
      noteInput.addEventListener("input", (e) => {
        state.form.note = e.target.value.slice(0, 40);
      });
    }

    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const form = sanitizeForm(state.form);
        const validationError = validateNodeInput(form, null);
        if (validationError) {
          setToast(validationError);
          return;
        }

        if (!["asset_account", "payment_instrument", "expense_category"].includes(form.type)) {
          setToast("Unsupported node type.");
          return;
        }

        const node = {
          id: createNodeId(),
          type: form.type,
          subtype: form.type === "asset_account" ? form.subtype : null,
          provider: form.provider || "",
          name: form.name,
          note: form.note,
          createdAt: Date.now(),
        };

        state.nodes.push(node);
        clearSelections();
        persist();
        render();
      });
    }

    if (updateBtn) {
      updateBtn.addEventListener("click", () => {
        const node = state.nodes.find((n) => n.id === state.selectedNodeId);
        if (!node || node.type === "salary_account") return;
        const form = sanitizeForm(state.form);

        if (node.type !== form.type) {
          setToast("Type change is not allowed in update.");
          return;
        }

        const validationError = validateNodeInput(form, node);
        if (validationError) {
          setToast(validationError);
          return;
        }

        node.subtype = node.type === "asset_account" ? form.subtype : null;
        node.provider = form.provider;
        node.name = form.name;
        node.note = form.note;
        persist();
        render();
        setToast("Node updated.");
      });
    }

    if (deleteNodeBtn) {
      deleteNodeBtn.addEventListener("click", () => {
        const node = state.nodes.find((n) => n.id === state.selectedNodeId);
        if (!node) return;
        if (node.type === "salary_account") {
          setToast("Salary account cannot be deleted.");
          return;
        }
        openConfirm(
          "Deleting this node also deletes all connected edges. Continue?",
          () => {
            state.nodes = state.nodes.filter((n) => n.id !== node.id);
            state.edges = state.edges.filter((e) => e.from !== node.id && e.to !== node.id);
            clearSelections();
            persist();
            render();
            setToast("Node deleted.");
          }
        );
      });
    }

    if (deleteEdgeBtn) {
      deleteEdgeBtn.addEventListener("click", () => {
        const edge = state.edges.find((e) => e.id === state.selectedEdgeId);
        if (!edge) return;
        openConfirm("Disconnect this edge?", () => {
          state.edges = state.edges.filter((e) => e.id !== edge.id);
          state.selectedEdgeId = null;
          persist();
          render();
          setToast("Edge disconnected.");
        });
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        openConfirm("All data will be removed. Reset now?", () => {
          const introSeen = state.introSeen;
          const next = defaultState();
          next.introSeen = introSeen;
          Object.assign(state, next);
          ensureSalaryNode();
          persist();
          render();
          setToast("All data reset.");
        });
      });
    }

    if (shareBtn) {
      shareBtn.addEventListener("click", handleShare);
    }
  }

  function renderGraphOnly() {
    const canvas = document.getElementById("canvasWrap");
    const edgeLayer = document.getElementById("edgeLayer");
    const nodeLayer = document.getElementById("nodeLayer");
    if (!canvas || !edgeLayer || !nodeLayer) return;

    const rect = canvas.getBoundingClientRect();
    const positions = layoutNodes(rect);

    const defs = `
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#3f6175"></path>
        </marker>
      </defs>
    `;

    edgeLayer.innerHTML = defs;
    state.edges.forEach((edge) => {
      const from = positions[edge.from];
      const to = positions[edge.to];
      if (!from || !to) return;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(from.x));
      line.setAttribute("y1", String(from.y + 24));
      line.setAttribute("x2", String(to.x));
      line.setAttribute("y2", String(to.y - 24));
      line.setAttribute("class", `edge${state.selectedEdgeId === edge.id ? " selected" : ""}`);
      line.setAttribute("marker-end", "url(#arrow)");
      line.addEventListener("click", (event) => {
        event.stopPropagation();
        state.selectedEdgeId = edge.id;
        state.selectedNodeId = null;
        state.connectSourceId = null;
        render();
      });
      edgeLayer.appendChild(line);
    });

    edgeLayer.onclick = () => {
      if (state.selectedEdgeId) {
        state.selectedEdgeId = null;
        render();
      }
    };

    const sortedForRender = state.nodes.slice().sort((a, b) => {
      const rank = {
        salary_account: 1,
        asset_account: 2,
        payment_instrument: 3,
        expense_category: 4,
      };
      return rank[a.type] - rank[b.type];
    });

    nodeLayer.innerHTML = "";
    sortedForRender.forEach((node) => {
      const pos = positions[node.id];
      if (!pos) return;
      const nodeEl = document.createElement("button");
      nodeEl.className = `node${state.selectedNodeId === node.id ? " selected" : ""}${
        state.connectSourceId === node.id ? " connect-source" : ""
      }`;
      nodeEl.dataset.id = node.id;
      nodeEl.dataset.type = node.type;
      nodeEl.style.left = `${pos.x}px`;
      nodeEl.style.top = `${pos.y}px`;
      nodeEl.innerHTML = `
        <span class="node-name">${escapeHtml(node.name)}</span>
        <span class="node-sub">${escapeHtml(
          node.type === "asset_account" ? subtypeLabel(node.subtype) : TYPE_LABEL[node.type]
        )}</span>
      `;
      nodeEl.addEventListener("click", (event) => {
        event.stopPropagation();
        handleNodeClick(node.id);
      });
      nodeLayer.appendChild(nodeEl);
    });

    nodeLayer.onclick = () => {
      clearSelections();
      render();
    };
  }

  function handleNodeClick(nodeId) {
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    state.selectedEdgeId = null;

    if (!state.connectSourceId) {
      state.connectSourceId = nodeId;
      state.selectedNodeId = nodeId;
      render();
      return;
    }

    if (state.connectSourceId === nodeId) {
      state.connectSourceId = null;
      state.selectedNodeId = nodeId;
      render();
      return;
    }

    const from = state.nodes.find((n) => n.id === state.connectSourceId);
    const to = node;
    if (!from || !to) {
      state.connectSourceId = null;
      render();
      return;
    }

    if (!isAllowedConnection(from.type, to.type)) {
      state.connectSourceId = null;
      state.selectedNodeId = to.id;
      render();
      setToast("Disallowed connection.");
      return;
    }

    if (from.id === to.id) {
      state.connectSourceId = null;
      setToast("Self-connection is not allowed.");
      render();
      return;
    }

    const duplicated = state.edges.some((edge) => edge.from === from.id && edge.to === to.id);
    if (duplicated) {
      state.connectSourceId = null;
      setToast("This edge already exists.");
      render();
      return;
    }

    state.edges.push({
      id: `edge-${Math.random().toString(36).slice(2, 10)}`,
      from: from.id,
      to: to.id,
    });
    state.connectSourceId = null;
    state.selectedNodeId = to.id;
    persist();
    render();
    setToast("Connected.");
  }

  function renderToast() {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = state.toast || "";
    toast.classList.toggle("show", !!state.toast);
  }

  function renderConfirm() {
    const root = document.getElementById("confirmRoot");
    if (!root) return;
    if (!state.confirmMessage) {
      root.innerHTML = "";
      return;
    }
    root.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(25,31,40,0.45);display:flex;align-items:center;justify-content:center;padding:20px;">
        <div style="width:min(360px,100%);background:#fff;border-radius:16px;padding:16px;box-shadow:0 10px 28px rgba(15,23,42,0.2);">
          <p style="margin:0;font-size:15px;line-height:1.5;color:#191f28;">${escapeHtml(
            state.confirmMessage
          )}</p>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
            <button class="btn btn-weak" id="confirmCancel">Cancel</button>
            <button class="btn btn-primary" id="confirmOk">Confirm</button>
          </div>
        </div>
      </div>
    `;

    const cancel = document.getElementById("confirmCancel");
    const ok = document.getElementById("confirmOk");
    cancel.addEventListener("click", closeConfirm);
    ok.addEventListener("click", () => {
      const exec = confirmHandler;
      closeConfirm();
      if (typeof exec === "function") exec();
    });
    setTimeout(() => cancel.focus(), 0);
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
})();
