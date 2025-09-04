// Frontend – chama o proxy Node em /api/*
const tbody = document.getElementById("tbody");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const emptyEl = document.getElementById("empty");
const pageInfo = document.getElementById("pageInfo");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const resetBtn = document.getElementById("resetBtn");
const createForm = document.getElementById("createForm");
const createStatus = document.getElementById("createStatus");

let state = {
  pageSize: 10,
  search: "",
  pages: [], // guardará offsets para voltar
  currentPageIndex: 0,
  currentOffset: null,
  nextOffset: null
};

async function fetchRecords(opts = {}) {
  const { offset = null, pushHistory = false } = opts;
  showLoading(true);
  setError(null);
  emptyEl.hidden = true;

  const params = new URLSearchParams();
  params.set("pageSize", state.pageSize);
  if (state.search) params.set("search", state.search);
  if (offset) params.set("offset", offset);

  try {
    const res = await fetch(`/api/records?${params.toString()}`);
    if (!res.ok) throw await res.json();
    const data = await res.json();

    // Atualiza offsets/paginação
    state.currentOffset = offset;
    state.nextOffset = data.offset || null;

    if (pushHistory) {
      // quando avançamos, guardamos o offset atual na pilha
      state.pages.push(offset || "FIRST");
      state.currentPageIndex = state.pages.length - 1;
    } else if (offset === null && !state.pages.length) {
      // inicial
      state.pages = ["FIRST"];
      state.currentPageIndex = 0;
    }

    renderTable(data.records || []);

    // estados UI
    if (!data.records || data.records.length === 0) {
      emptyEl.hidden = false;
    }
    updatePaginationButtons();
  } catch (err) {
    console.error(err);
    setError(err?.error?.message || "Falha ao carregar registros.");
  } finally {
    showLoading(false);
  }
}

function renderTable(records) {
  tbody.innerHTML = "";
  for (const rec of records) {
    const tr = document.createElement("tr");

    const nomeTd = document.createElement("td");
    const emailTd = document.createElement("td");
    const telefoneTd = document.createElement("td");
    const actionsTd = document.createElement("td");
    actionsTd.className = "cell-actions";

    const fields = rec.fields || {};
    nomeTd.textContent = fields.nome || "";
    emailTd.textContent = fields.email || "";
    telefoneTd.textContent = fields.telefone || "";

    // Botões
    const editBtn = document.createElement("button");
    editBtn.textContent = "Editar";
    editBtn.className = "ghost";
    editBtn.addEventListener("click", () => startInlineEdit(rec.id, tr, fields));

    const delBtn = document.createElement("button");
    delBtn.textContent = "Excluir";
    delBtn.className = "danger";
    delBtn.addEventListener("click", () => onDelete(rec.id));

    actionsTd.append(editBtn, delBtn);
    tr.append(nomeTd, emailTd, telefoneTd, actionsTd);
    tbody.appendChild(tr);
  }
}

function startInlineEdit(id, tr, fields) {
  const [nomeTd, emailTd, telefoneTd, actionsTd] = tr.children;

  const nomeInput = document.createElement("input");
  nomeInput.value = fields.nome || "";

  const emailInput = document.createElement("input");
  emailInput.type = "email";
  emailInput.value = fields.email || "";

  const telInput = document.createElement("input");
  telInput.value = fields.telefone || "";

  nomeTd.innerHTML = "";
  emailTd.innerHTML = "";
  telefoneTd.innerHTML = "";
  nomeTd.appendChild(nomeInput);
  emailTd.appendChild(emailInput);
  telefoneTd.appendChild(telInput);

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Salvar";
  saveBtn.className = "primary";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancelar";
  cancelBtn.className = "ghost";

  const oldActions = [...actionsTd.children];
  actionsTd.innerHTML = "";
  actionsTd.append(saveBtn, cancelBtn);

  saveBtn.addEventListener("click", async () => {
    const payload = {
      nome: nomeInput.value.trim(),
      email: emailInput.value.trim(),
      telefone: telInput.value.trim()
    };
    if (!payload.nome || !payload.email) {
      alert("Nome e email são obrigatórios.");
      return;
    }
    try {
      saveBtn.disabled = true;
      const res = await fetch(`/api/records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw await res.json();
      // reload página atual
      await fetchRecords({ offset: state.currentOffset });
    } catch (err) {
      console.error(err);
      alert(err?.error?.message || "Falha ao salvar.");
    } finally {
      saveBtn.disabled = false;
    }
  });

  cancelBtn.addEventListener("click", () => {
    // simplesmente recarrega a página atual para restaurar a linha
    fetchRecords({ offset: state.currentOffset });
  });
}

async function onDelete(id) {
  if (!confirm("Deseja excluir este registro?")) return;
  try {
    const res = await fetch(`/api/records/${id}`, { method: "DELETE" });
    if (!res.ok) throw await res.json();
    // Atualiza a lista mantendo o offset atual
    await fetchRecords({ offset: state.currentOffset });
  } catch (err) {
    console.error(err);
    alert(err?.error?.message || "Falha ao excluir.");
  }
}

createForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  createStatus.textContent = "";
  const nome = document.getElementById("nome").value.trim();
  const email = document.getElementById("email").value.trim();
  const telefone = document.getElementById("telefone").value.trim();

  if (!nome || !email) {
    createStatus.textContent = "Preencha nome e email.";
    return;
  }
  try {
    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, telefone })
    });
    if (!res.ok) throw await res.json();
    // Limpa formulário e recarrega
    createForm.reset();
    createStatus.textContent = "Criado com sucesso!";
    setTimeout(() => (createStatus.textContent = ""), 2000);
    await fetchRecords({ offset: state.currentOffset });
  } catch (err) {
    console.error(err);
    createStatus.textContent = err?.error?.message || "Falha ao criar.";
  }
});

searchBtn.addEventListener("click", () => {
  state.search = searchInput.value.trim();
  // Reinicia paginação
  state.pages = [];
  state.currentPageIndex = 0;
  fetchRecords({ offset: null });
});

resetBtn.addEventListener("click", () => {
  searchInput.value = "";
  state.search = "";
  state.pages = [];
  state.currentPageIndex = 0;
  fetchRecords({ offset: null });
});

prevBtn.addEventListener("click", () => {
  // Voltar: usamos a pilha de offsets salvos. O índice 0 é "FIRST" (offset null).
  if (state.currentPageIndex > 0) {
    state.currentPageIndex -= 1;
    const prevMarker = state.pages[state.currentPageIndex];
    const offset = prevMarker === "FIRST" ? null : prevMarker;
    fetchRecords({ offset });
  }
});

nextBtn.addEventListener("click", () => {
  if (state.nextOffset) {
    // ao avançar, guardamos o offset atual para poder voltar depois
    fetchRecords({ offset: state.nextOffset, pushHistory: true });
  }
});

function showLoading(isLoading) {
  loadingEl.hidden = !isLoading;
  document.getElementById("clientsTable").hidden = isLoading;
}

function setError(msg) {
  if (!msg) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  } else {
    errorEl.hidden = false;
    errorEl.textContent = msg;
  }
}

function updatePaginationButtons() {
  // prev habilitado se não estamos na primeira página
  prevBtn.disabled = state.currentPageIndex <= 0;
  // next habilitado se existe offset
  nextBtn.disabled = !state.nextOffset;
  const page = state.currentPageIndex + 1;
  pageInfo.textContent = `Página ${page}`;
}

// Inicialização
fetchRecords();
