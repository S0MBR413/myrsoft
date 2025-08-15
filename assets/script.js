import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variáveis globais fornecidas pelo ambiente Canvas
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = {
    apiKey: "AIzaSyCHFQCssMQxn0tLx9DFmJGf5PG8DeGC6_k",
    authDomain: "myrsoft-e08a8.firebaseapp.com",
    projectId: "myrsoft-e08a8",
    storageBucket: "myrsoft-e08a8.firebasestorage.app",
    messagingSenderId: "610605412336",
    appId: "1:610605412336:web:b99c0ccb61a5f16676f735",
    measurementId: "G-E1F21ZZSK6"
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Inicializar Firebase
let app;
let db;
let auth;
let userId = 'loading';
let isAuthReady = false;

// Variáveis para armazenar dados do Firestore
let allProducts = [];
let allCategories = [];
let allSubcategories = [];

// Filtro de produtos
let currentFilter = {
    categoryId: null,
    subcategoryId: null
};

// Função para mostrar mensagem modal (global)
function showMessageModal(message) {
    document.getElementById('messageText').textContent = message;
    document.getElementById('messageModal').classList.add('show');
    document.getElementById('overlay').classList.add('show');
}

// Função para fechar mensagem modal (global)
function closeMessageModal() {
    document.getElementById('messageModal').classList.remove('show');
    document.getElementById('overlay').classList.remove('show');
}

document.getElementById('closeMessageModal').addEventListener('click', closeMessageModal);

// Referências para o modal de detalhes do evento
const eventDetailsModal = document.getElementById('eventDetailsModal');
const eventDetailsImage = document.getElementById('eventDetailsImage');
const eventDetailsName = document.getElementById('eventDetailsName');
const eventDetailsDescription = document.getElementById('eventDetailsDescription');
const eventDetailsDate = document.getElementById('eventDetailsDate');
const eventDetailsLocation = document.getElementById('eventDetailsLocation');
const eventDetailsLinkBtn = document.getElementById('eventDetailsLinkBtn');
const closeEventDetailsModal = document.getElementById('closeEventDetailsModal');
const eventDetailsOverlay = document.getElementById('eventDetailsOverlay');

// Função para abrir o modal de detalhes do evento
function openEventDetails(event) {
    eventDetailsName.textContent = event.name;
    eventDetailsDescription.textContent = event.description;
    if (event.date) {
        const dateObj = new Date(event.date + 'T00:00:00');
        eventDetailsDate.textContent = dateObj.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
    } else {
        eventDetailsDate.textContent = 'Data não informada';
    }
    eventDetailsLocation.textContent = event.location;

    if (event.imageData && event.imageData.trim() !== '') {
        eventDetailsImage.src = event.imageData;
        eventDetailsImage.classList.remove('hidden');
    } else {
        eventDetailsImage.classList.add('hidden');
        eventDetailsImage.src = '';
    }

    if (event.eventLink && event.eventLink.trim() !== '') {
        eventDetailsLinkBtn.href = event.eventLink;
        eventDetailsLinkBtn.classList.remove('hidden');
    } else {
        eventDetailsLinkBtn.classList.add('hidden');
        eventDetailsLinkBtn.href = '#';
    }

    eventDetailsModal.classList.add('show');
    eventDetailsOverlay.classList.add('show');
}

// Event listener para fechar o modal de detalhes do evento
closeEventDetailsModal.addEventListener('click', () => {
    eventDetailsModal.classList.remove('show');
    eventDetailsOverlay.classList.remove('show');
});

// Referências para o modal de detalhes do produto
const productDetailsModal = document.getElementById('productDetailsModal');
const productDetailsImage = document.getElementById('productDetailsImage');
const productDetailsName = document.getElementById('productDetailsName');
const productDetailsDescription = document.getElementById('productDetailsDescription');
const productDetailsPrice = document.getElementById('productDetailsPrice');
const productDetailsQuantity = document.getElementById('productDetailsQuantity');
const productDetailsCategory = document.getElementById('productDetailsCategory');
const closeProductDetailsModal = document.getElementById('closeProductDetailsModal');
const productDetailsOverlay = document.getElementById('productDetailsOverlay');

// Função para abrir o modal de detalhes do produto
function openProductDetails(product) {
    productDetailsName.textContent = product.name;
    productDetailsDescription.textContent = product.description;
    productDetailsPrice.textContent = `R$ ${product.price.toFixed(2)}`;
    productDetailsQuantity.textContent = product.quantity;
    // Exibe o caminho completo da categoria/subcategoria no modal de detalhes
    let fullPath = product.category;
    if (product.subcategoryId) {
        fullPath = getSubcategoryFullPath(product.subcategoryId);
    }
    productDetailsCategory.textContent = fullPath;


    if (product.imageData && product.imageData.trim() !== '') {
        productDetailsImage.src = product.imageData;
        productDetailsImage.classList.remove('hidden');
    } else {
        productDetailsImage.classList.add('hidden');
        productDetailsImage.src = '';
    }

    productDetailsModal.classList.add('show');
    document.getElementById('overlay').classList.add('show');
}

// Event listener para fechar o modal de detalhes do produto
closeProductDetailsModal.addEventListener('click', () => {
    productDetailsModal.classList.remove('show');
    document.getElementById('overlay').classList.remove('show');
});


// Funções para lidar com as seções e navegação
function handleHashChange() {
    const hash = window.location.hash;
    const lojaSection = document.getElementById('loja');
    const eventosSection = document.getElementById('eventos');

    lojaSection.classList.add('hidden');
    eventosSection.classList.add('hidden');

    if (hash === '#eventos') {
        eventosSection.classList.remove('hidden');
    } else {
        lojaSection.classList.remove('hidden');
    }
}

window.addEventListener('hashchange', handleHashChange);

// --- Lógica para Sidebar de Categorias ---
const openCategoriesBtn = document.getElementById('openCategoriesBtn');
const closeCategoriesBtn = document.getElementById('closeCategoriesBtn');
const categoriesSidebar = document.getElementById('categoriesSidebar');
const categoriesOverlay = document.getElementById('categoriesOverlay');
const categoriesList = document.getElementById('categoriesList');
const clearCategoryFilterBtn = document.getElementById('clearCategoryFilter');

openCategoriesBtn.addEventListener('click', () => {
    categoriesSidebar.classList.add('open');
    categoriesOverlay.classList.add('show');
});

closeCategoriesBtn.addEventListener('click', () => {
    categoriesSidebar.classList.remove('open');
    categoriesOverlay.classList.remove('show');
});

categoriesOverlay.addEventListener('click', () => {
    categoriesSidebar.classList.remove('open');
    categoriesOverlay.classList.remove('show');
});

clearCategoryFilterBtn.addEventListener('click', () => {
    currentFilter.categoryId = null;
    currentFilter.subcategoryId = null;
    renderStoreProducts(allProducts); // Renderiza todos os produtos novamente
    categoriesList.querySelectorAll('a').forEach(link => link.classList.remove('active'));
    categoriesSidebar.classList.remove('open');
    categoriesOverlay.classList.remove('show');
});


// Inicializa Firebase e autenticação
async function initializeFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                isAuthReady = true;
                console.log('Usuário autenticado:', userId);
                setupFirestoreListeners();
            } else {
                if (!initialAuthToken) {
                    try {
                        await signInAnonymously(auth);
                        console.log('Autenticado anonimamente.');
                    } catch (anonError) {
                        console.error('Erro ao tentar autenticação anônima:', anonError);
                        showMessageModal(`Erro na autenticação anônima: ${anonError.message}. Por favor, verifique se a Autenticação Anônima está ativada no seu projeto Firebase em "Build > Authentication".`);
                    }
                } else {
                    console.error('Falha na autenticação com token. Por favor, tente novamente.');
                    showMessageModal('Falha na autenticação com token. Tente novamente.');
                }
            }
        });

        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log('Autenticado com token personalizado.');
        } else {
            await signInAnonymously(auth);
            console.log('Autenticado anonimamente (inicial).');
        }

    } catch (error) {
        console.error("Erro ao inicializar Firebase ou autenticar:", error);
        if (error.code === 'auth/configuration-not-found') {
            showMessageModal(`Erro ao carregar a loja: ${error.message}. Por favor, **certifique-se de que a Autenticação está ativada (especialmente o método Anônimo)** no seu projeto Firebase Console em "Build > Authentication".`);
            console.warn('Para resolver auth/configuration-not-found, ative a Autenticação (método Anônimo) no seu projeto Firebase Console.');
        } else if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
            showMessageModal(`Erro ao carregar dados: ${error.message}. Por favor, verifique as **Regras de Segurança do Firestore** no seu projeto Firebase Console em "Build > Firestore Database > Rules". Certifique-se de que as permissões de leitura/escrita para 'artifacts/{appId}/public/data/products', 'artifacts/{appId}/public/data/events', 'artifacts/{appId}/public/data/categories' e 'artifacts/{appId}/public/data/subcategories' estão configuradas corretamente para usuários autenticados.`);
            console.warn('Para resolver "Missing or insufficient permissions", configure as Regras de Segurança do Firestore para permitir acesso adequado.');
        }
        else {
            showMessageModal(`Erro ao carregar a loja: ${error.message}.`);
        }
    }
}

window.onload = async function () {
    await initializeFirebase();
    handleHashChange();
};

// --- Lógica do Carrinho de Compras ---
let cart = [];
const cartFloatButton = document.getElementById('cartFloatButton');
const cartCount = document.getElementById('cartCount');
const cartModal = document.getElementById('cartModal');
const closeCartModal = document.getElementById('closeCartModal');
const cartItemsContainer = document.getElementById('cartItems');
const emptyCartMessage = document.getElementById('emptyCartMessage');
const cartTotalDisplay = document.getElementById('cartTotal');
const checkoutWhatsappBtn = document.getElementById('checkoutWhatsappBtn');
const productsByCategoryContainer = document.getElementById('productsByCategory');
const noProductsMessage = document.getElementById('noProductsMessage');
const eventGrid = document.getElementById('eventGrid');
const noEventsMessage = document.getElementById('noEventsMessage');

cartFloatButton.addEventListener('click', () => {
    cartModal.classList.add('open');
    renderCart();
});
closeCartModal.addEventListener('click', () => {
    cartModal.classList.remove('open');
});

checkoutWhatsappBtn.addEventListener('click', () => {
    sendOrderViaWhatsapp();
});

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    updateCartCount();
    renderCart();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartCount();
    renderCart();
}

function updateCartQuantity(productId, newQuantity) {
    const item = cart.find(i => i.id === productId);
    if (item) {
        item.quantity = Math.max(0, newQuantity);
        if (item.quantity === 0) {
            removeFromCart(productId);
        }
    }
    updateCartCount();
    renderCart();
}

function updateCartCount() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
}

function renderCart() {
    cartItemsContainer.innerHTML = '';

    if (cart.length === 0) {
        emptyCartMessage.classList.remove('hidden');
        cartTotalDisplay.textContent = 'R$ 0,00';
        checkoutWhatsappBtn.disabled = true;
        checkoutWhatsappBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        emptyCartMessage.classList.add('hidden');
        checkoutWhatsappBtn.disabled = false;
        checkoutWhatsappBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg shadow-sm mb-4';
        itemDiv.innerHTML = `
            <div class="flex-1">
                <h4 class="font-semibold text-lg">${item.name}</h4>
                <p class="text-sm text-gray-600">R$ ${item.price.toFixed(2)} cada</p>
                <p class="text-md font-medium text-red-600">Total: R$ ${itemTotal.toFixed(2)}</p>
            </div>
            <div class="flex items-center space-x-2">
                <button class="quantity-btn bg-gray-200 hover:bg-gray-300 text-gray-700 w-8 h-8 rounded-full flex items-center justify-center" data-product-id="${item.id}" data-action="decrease">-</button>
                <span class="font-bold text-lg">${item.quantity}</span>
                <button class="quantity-btn bg-gray-200 hover:bg-gray-300 text-gray-700 w-8 h-8 rounded-full flex items-center justify-center" data-product-id="${item.id}" data-action="increase">+</button>
                <button class="remove-from-cart-btn bg-red-100 hover:bg-red-200 text-red-600 w-8 h-8 rounded-full flex items-center justify-center ml-4" data-product-id="${item.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                        <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.275-2.314.593A3.003 3.003 0 002.5 6.066V9.5c0 .637.19.866.5.99.8.303 1.744.3 2.507.003h6.986c.763.297 1.708.301 2.507-.003.31-.124.5-.353.5-.99V6.066c0-.86-.384-1.644-1.07-2.176a4.512 4.512 0 00-2.314-.593V3.75A2.75 2.75 0 0011.25 1h-2.5zM3.5 11.082l.375 6.75a.75.75 0 00.74.668h10.37a.75.75 0 00.74-.668l.375-6.75A1.75 1.75 0 0016.03 9.25H3.97a1.75 1.75 0 00-1.479 1.832z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        `;
        cartItemsContainer.appendChild(itemDiv);
    });

    cartTotalDisplay.textContent = `R$ ${total.toFixed(2)}`;

    cartItemsContainer.querySelectorAll('.quantity-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            const action = event.target.dataset.action;
            const item = cart.find(i => i.id === productId);
            if (item) {
                if (action === 'increase') {
                    updateCartQuantity(productId, item.quantity + 1);
                } else if (action === 'decrease') {
                    updateCartQuantity(productId, item.quantity - 1);
                }
            }
        });
    });

    cartItemsContainer.querySelectorAll('.remove-from-cart-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            removeFromCart(productId);
        });
    });
}

function sendOrderViaWhatsapp() {
    if (cart.length === 0) {
        showMessageModal('Seu carrinho está vazio. Adicione itens antes de finalizar o pedido.');
        return;
    }

    let message = "Olá! Gostaria de fazer o seguinte pedido da Myrsoft:\n\n";
    let total = 0;

    cart.forEach(item => {
        message += `${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}\n`;
        total += item.price * item.quantity;
    });

    message += `\nTotal do Pedido: R$ ${total.toFixed(2)}`;
    message += `\n\nPor favor, me informe sobre as opções de pagamento e entrega.`;

    const whatsappNumber = "5585921522324";
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

// Função para carregar e renderizar dados do Firestore
function setupFirestoreListeners() {
    if (!isAuthReady) {
        console.warn('Firestore não pronto, aguardando autenticação.');
        return;
    }

    // Listener para produtos
    const productsColRef = collection(db, `artifacts/${appId}/public/data/products`);
    onSnapshot(productsColRef, (snapshot) => {
        allProducts = [];
        snapshot.forEach((doc) => {
            allProducts.push({ id: doc.id, ...doc.data() });
        });
        renderStoreProducts(allProducts);
    }, (error) => {
        console.error("Erro ao carregar produtos:", error);
        showMessageModal(`Erro ao carregar produtos: ${error.message}. Por favor, verifique as **Regras de Segurança do Firestore** para 'products'.`);
    });

    // Listener para eventos
    const eventsColRef = collection(db, `artifacts/${appId}/public/data/events`);
    onSnapshot(eventsColRef, (snapshot) => {
        const events = [];
        snapshot.forEach((doc) => {
            events.push({ id: doc.id, ...doc.data() });
        });
        renderStoreEvents(events);
    }, (error) => {
        console.error("Erro ao carregar eventos:", error);
        showMessageModal(`Erro ao carregar eventos: ${error.message}. Por favor, verifique as **Regras de Segurança do Firestore** para 'events'.`);
    });

    // Listener para categorias
    const categoriesColRef = collection(db, `artifacts/${appId}/public/data/categories`);
    onSnapshot(categoriesColRef, (snapshot) => {
        allCategories = [];
        snapshot.forEach((doc) => {
            allCategories.push({ id: doc.id, ...doc.data() });
        });
        renderCategoriesMenu(); // Renderiza o menu de categorias
    }, (error) => {
        console.error("Erro ao carregar categorias:", error);
        showMessageModal(`Erro ao carregar categorias: ${error.message}. Por favor, verifique as **Regras de Segurança do Firestore** para 'categories'.`);
    });

    // Listener para subcategorias
    const subcategoriesColRef = collection(db, `artifacts/${appId}/public/data/subcategories`);
    onSnapshot(subcategoriesColRef, (snapshot) => {
        allSubcategories = [];
        snapshot.forEach((doc) => {
            allSubcategories.push({ id: doc.id, ...doc.data() });
        });
        renderCategoriesMenu(); // Renderiza o menu de categorias (para incluir subcategorias)
    }, (error) => {
        console.error("Erro ao carregar subcategorias:", error);
        showMessageModal(`Erro ao carregar subcategorias: ${error.message}. Por favor, verifique as **Regras de Segurança do Firestore** para 'subcategories'.`);
    });
}

/**
 * Função auxiliar para coletar todos os IDs de subcategorias descendentes de um determinado parentId.
 * @param {string} parentId - O ID da categoria ou subcategoria pai.
 * @param {Array<object>} allSubcategoriesList - Lista completa de todas as subcategorias.
 * @param {Array<string>} collectedIds - Array para armazenar os IDs coletados.
 */
function collectDescendantSubcategoryIds(parentId, allSubcategoriesList, collectedIds) {
    const children = allSubcategoriesList.filter(sub => {
        // Uma subcategoria é um filho direto se:
        // 1. Seu categoryId corresponde a parentId E não tem parentSubcategoryId (é uma subcategoria de nível 1 de uma categoria principal)
        // 2. Seu parentSubcategoryId corresponde a parentId (é uma subcategoria aninhada de outra subcategoria)
        return (sub.categoryId === parentId && !sub.parentSubcategoryId) || (sub.parentSubcategoryId === parentId);
    });

    children.forEach(child => {
        if (!collectedIds.includes(child.id)) {
            collectedIds.push(child.id);
            collectDescendantSubcategoryIds(child.id, allSubcategoriesList, collectedIds); // Recursão para níveis mais profundos
        }
    });
}

/**
 * Função auxiliar para obter o caminho completo da subcategoria (ex: Categoria > Subcategoria Nivel 1 > Subcategoria Nivel 2).
 * Prevê a duplicação de nomes de subcategorias consecutivas no caminho.
 * @param {string} subcategoryId - O ID da subcategoria.
 * @returns {string} O caminho completo da subcategoria.
 */
function getSubcategoryFullPath(subcategoryId) {
    let pathSegments = [];
    let currentSub = allSubcategories.find(s => s.id === subcategoryId);
    
    // Constrói o caminho do filho para o pai, coletando nomes
    while (currentSub) {
        pathSegments.unshift(currentSub.name); // Adiciona ao início
        currentSub = allSubcategories.find(s => s.id === currentSub.parentSubcategoryId);
    }

    // Adiciona o nome da categoria principal se ainda não for o primeiro segmento
    const mainCategoryOfSub = allCategories.find(cat => cat.id === (allSubcategories.find(s => s.id === subcategoryId)?.categoryId || null));
    if (mainCategoryOfSub) {
        // Se o primeiro segmento coletado das subcategorias NÃO é o nome da categoria principal, adicione o nome da categoria principal.
        // Isso previne "Categoria > Subcategoria > Subcategoria" se Subcategoria tem o mesmo nome da Categoria
        if (pathSegments.length === 0 || pathSegments[0] !== mainCategoryOfSub.name) {
            pathSegments.unshift(mainCategoryOfSub.name);
        }
    }

    // Pós-processa para remover duplicatas consecutivas
    const finalPath = [];
    pathSegments.forEach((segment, index) => {
        if (index === 0 || segment !== pathSegments[index - 1]) {
            finalPath.push(segment);
        }
    });

    return finalPath.join(' > ');
}

/**
 * Renderiza os produtos na seção da loja, agrupados por categoria e subcategoria, aplicando filtros.
 * @param {Array<object>} productsToRender - Array de objetos de produto.
 */
function renderStoreProducts(productsToRender) {
    productsByCategoryContainer.innerHTML = '';
    noProductsMessage.classList.add('hidden');

    let productsToDisplay = productsToRender; // Começa com todos os produtos ou o array passado

    if (currentFilter.subcategoryId) {
        // Se uma subcategoria específica é selecionada, filtra pelo ID da subcategoria E seus descendentes
        const selectedSubcategoryId = currentFilter.subcategoryId;
        const relevantFilterSubcategoryIds = [selectedSubcategoryId]; // Começa com a subcategoria selecionada

        // Coleta todos os IDs de subcategorias descendentes a partir da subcategoria selecionada
        collectDescendantSubcategoryIds(selectedSubcategoryId, allSubcategories, relevantFilterSubcategoryIds);

        productsToDisplay = productsToDisplay.filter(p => {
            // Inclui produtos se o seu subcategoryId corresponde ao selecionado OU a qualquer um de seus descendentes
            return p.subcategoryId && relevantFilterSubcategoryIds.includes(p.subcategoryId);
        });

    } else if (currentFilter.categoryId) {
        // Se uma categoria principal é selecionada (e nenhuma subcategoria específica)
        const mainCategoryId = currentFilter.categoryId;
        const relevantFilterIds = []; // Inicializa com a categoria principal

        // Adiciona o ID da categoria principal à lista de IDs relevantes, pois produtos podem estar diretamente nela
        relevantFilterIds.push(mainCategoryId);

        // Coleta todos os IDs de subcategorias descendentes a partir desta categoria principal
        collectDescendantSubcategoryIds(mainCategoryId, allSubcategories, relevantFilterIds);

        productsToDisplay = productsToDisplay.filter(p => {
            // Inclui produtos se:
            // 1. Eles estão diretamente ligados à categoria principal (sem subcategory ID)
            if (p.categoryId === mainCategoryId && !p.subcategoryId) {
                return true;
            }
            // 2. Eles estão ligados a qualquer uma das subcategorias descendentes (via subcategoryId)
            if (p.subcategoryId && relevantFilterIds.includes(p.subcategoryId)) {
                return true;
            }
            return false; // Caso contrário, exclui
        });
    }

    // Agora usa 'productsToDisplay' para renderizar
    if (productsToDisplay.length === 0) {
        noProductsMessage.classList.remove('hidden');
        return;
    }

    // Agrupar produtos por categoria e depois por subcategoria para renderização
    const productsGroupedByCategory = {};
    productsToDisplay.forEach(product => {
        const categoryName = product.category || 'Outros'; // Fallback para categoria se não definida
        if (!productsGroupedByCategory[categoryName]) {
            productsGroupedByCategory[categoryName] = {};
        }
        const subcategoryDisplayPath = product.subcategoryId ? getSubcategoryFullPath(product.subcategoryId) : 'Sem Subcategoria';
        
        let finalSubcategoryDisplayPath = subcategoryDisplayPath;
        const mainCategoryNameForProduct = allCategories.find(c => c.id === product.categoryId)?.name;
        
        // Remove o nome da categoria principal do caminho da subcategoria se ela já foi exibida como título de categoria
        if (mainCategoryNameForProduct && finalSubcategoryDisplayPath.startsWith(mainCategoryNameForProduct + ' > ')) {
            finalSubcategoryDisplayPath = finalSubcategoryDisplayPath.substring(mainCategoryNameForProduct.length + 3);
        }
        
        if (finalSubcategoryDisplayPath === '') { // Caso seja uma subcategoria de 1º nível e o nome da categoria foi removido
            finalSubcategoryDisplayPath = 'Sem Subcategoria Filha';
        }

        if (!productsGroupedByCategory[categoryName][finalSubcategoryDisplayPath]) {
            productsGroupedByCategory[categoryName][finalSubcategoryDisplayPath] = [];
        }
        productsGroupedByCategory[categoryName][finalSubcategoryDisplayPath].push(product);
    });

    const sortedCategories = Object.keys(productsGroupedByCategory).sort();

    sortedCategories.forEach(categoryName => {
        const categorySection = document.createElement('div');
        categorySection.className = 'mb-10';

        const categoryTitle = document.createElement('h3');
        categoryTitle.className = 'text-3xl font-bold text-gray-800 mb-6 border-b-2 border-red-400 pb-2 capitalize';
        categoryTitle.textContent = categoryName;

        categorySection.appendChild(categoryTitle);

        const sortedSubcategories = Object.keys(productsGroupedByCategory[categoryName]).sort();
        sortedSubcategories.forEach(subcategoryDisplayPath => {
            const subcategorySection = document.createElement('div');
            subcategorySection.className = 'mb-8';

            if (subcategoryDisplayPath !== 'Sem Subcategoria' && subcategoryDisplayPath !== 'Sem Subcategoria Filha') {
                const subcategoryTitle = document.createElement('h4');
                subcategoryTitle.className = 'text-2xl font-semibold text-gray-700 mb-4 ml-4';
                subcategoryTitle.textContent = subcategoryDisplayPath;
                subcategorySection.appendChild(subcategoryTitle);
            } else if (subcategoryDisplayPath === 'Sem Subcategoria Filha' && Object.keys(productsGroupedByCategory[categoryName]).length > 1) {
                    // Apenas exibe se houver outras subcategorias para diferenciar
                const subcategoryTitle = document.createElement('h4');
                subcategoryTitle.className = 'text-2xl font-semibold text-gray-700 mb-4 ml-4';
                subcategoryTitle.textContent = 'Outros Produtos desta Categoria';
                subcategorySection.appendChild(subcategoryTitle);
            }


            const productGrid = document.createElement('div'); 
            productGrid.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8';

            productsGroupedByCategory[categoryName][subcategoryDisplayPath].forEach(product => {
                const imageUrl = product.imageData && product.imageData.trim() !== '' ? product.imageData : `https://placehold.co/400x300/e0e0e0/000000?text=${encodeURIComponent(product.name)}`;
                const productCard = document.createElement('div');
                productCard.className = 'bg-white rounded-lg shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-300';
                productCard.innerHTML = `
                    <img src="${imageUrl}" onerror="this.onerror=null;this.src='https://placehold.co/400x300/e0e0e0/000000?text=Erro+ao+carregar+imagem';" alt="${product.name}" class="w-full h-48 object-cover rounded-t-lg">
                    <div class="p-6">
                        <h3 class="font-bold text-xl mb-2">${product.name}</h3>
                        <p class="text-gray-600 text-sm mb-4">${product.description}</p>
                        <p class="font-semibold text-xl text-red-600 mb-2">R$ ${product.price.toFixed(2)}</p>
                        <p class="text-gray-500 text-xs mb-4">Disponível: ${product.quantity}</p>
                        <button class="view-product-details-btn bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full w-full transition-colors duration-200 mb-2"
                                data-product-id="${product.id}">
                            Ver Detalhes
                        </button>
                        <button class="add-to-cart-btn bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full w-full transition-colors duration-200"
                                data-product-id="${product.id}" data-product-name="${product.name}" data-product-price="${product.price}" ${product.quantity <= 0 ? 'disabled' : ''}>
                            ${product.quantity > 0 ? 'Adicionar ao Carrinho' : 'Esgotado'}
                        </button>
                    </div>
                `;
                productGrid.appendChild(productCard);
            });
            subcategorySection.appendChild(productGrid);
            categorySection.appendChild(subcategorySection);
        });
        productsByCategoryContainer.appendChild(categorySection);
    });

    document.querySelectorAll('.view-product-details-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            const productToDisplay = allProducts.find(p => p.id === productId);
            if (productToDisplay) {
                openProductDetails(productToDisplay);
            }
        });
    });

    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            const productName = event.target.dataset.productName;
            const productPrice = parseFloat(event.target.dataset.productPrice);
            addToCart({ id: productId, name: productName, price: productPrice });
        });
    });
}


/**
 * Renderiza os eventos na seção de eventos da loja.
 * @param {Array<object>} events - Array de objetos de evento.
 */
function renderStoreEvents(events) {
    eventGrid.innerHTML = '';
    if (events.length === 0) {
        noEventsMessage.classList.remove('hidden');
    } else {
        noEventsMessage.classList.add('hidden');
        events.forEach(event => {
            const imageUrl = event.imageData && event.imageData.trim() !== '' ? event.imageData : `https://placehold.co/400x300/e0e0e0/000000?text=${encodeURIComponent(event.name)}`;
            const eventCard = document.createElement('div');
            eventCard.className = 'bg-white rounded-lg shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-300';
            eventCard.innerHTML = `
                <img src="${imageUrl}" onerror="this.onerror=null;this.src='https://placehold.co/400x300/e0e0e0/000000?text=Erro+ao+carregar+imagem';" alt="${event.name}" class="w-full h-48 object-cover rounded-t-lg">
                <div class="p-6">
                    <h3 class="font-bold text-xl mb-2">${event.name}</h3>
                    <p class="text-gray-600 text-sm mb-4">${event.description}</p>
                    <p class="font-semibold text-md text-gray-700 mb-2">Data: ${new Date(event.date).toLocaleDateString('pt-BR')}</p>
                    <p class="text-gray-500 text-xs mb-4">Local: ${event.location}</p>
                    <button class="view-event-details-btn bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full w-full transition-colors duration-200"
                            data-event-id="${event.id}">
                        Ver Detalhes
                    </button>
                    ${event.eventLink ? `<a href="${event.eventLink}" target="_blank" class="block text-center mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full w-full transition-colors duration-200">Ir para o Evento</a>` : ''}
                </div>
            `;
            eventGrid.appendChild(eventCard);
        });

        document.querySelectorAll('.view-event-details-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const eventId = event.target.dataset.eventId;
                const eventToDisplay = events.find(e => e.id === eventId);
                if (eventToDisplay) {
                    openEventDetails(eventToDisplay);
                }
            });
        });
    }
}

/**
 * Renderiza o menu de categorias e subcategorias na sidebar.
 */
function renderCategoriesMenu() {
    categoriesList.innerHTML = '';

    // Mapeia subcategorias por categoria pai e por subcategoria pai (para aninhamento)
    const subcategoriesByParent = allSubcategories.reduce((acc, sub) => {
        const parentId = sub.parentSubcategoryId || sub.categoryId; // Usa categoryId como pai se não houver parentSubcategoryId
        if (!acc[parentId]) {
            acc[parentId] = [];
        }
        acc[parentId].push(sub);
        return acc;
    }, {});

    // Função recursiva para renderizar subcategorias
    const renderSubcategories = (parentId, ulElement) => {
        // Filtra subcategorias que são filhas diretas do parentId atual
        const directChildren = (subcategoriesByParent[parentId] || []).filter(sub => {
            // Se o parentId é uma Categoria (sub.categoryId === parentId e !sub.parentSubcategoryId)
            // Ou se o parentId é uma Subcategoria (sub.parentSubcategoryId === parentId)
            return (sub.categoryId === parentId && !sub.parentSubcategoryId) || (sub.parentSubcategoryId === parentId);
        });

        directChildren.sort((a, b) => a.name.localeCompare(b.name)).forEach(sub => {
            const subcategoryLi = document.createElement('li');
            const subcategoryLink = document.createElement('a');
            subcategoryLink.href = "#";
            
            // Exibe o caminho completo da subcategoria no link da sidebar
            let displayPath = getSubcategoryFullPath(sub.id);
            // Remove o nome da categoria principal se for um filtro de subcategoria
            const mainCategoryOfSub = allCategories.find(cat => cat.id === sub.categoryId);
            if (mainCategoryOfSub && displayPath.startsWith(mainCategoryOfSub.name + ' > ')) {
                displayPath = displayPath.substring(mainCategoryOfSub.name.length + 3);
            }
            subcategoryLink.textContent = displayPath;
            
            subcategoryLink.dataset.categoryId = sub.categoryId;
            subcategoryLink.dataset.subcategoryId = sub.id;
            subcategoryLink.className = 'subcategory-filter-link';

            if (currentFilter.subcategoryId === sub.id) {
                subcategoryLink.classList.add('active');
            }

            // Adiciona um identificador para itens aninhados para fins de estilo
            if (sub.parentSubcategoryId) {
                subcategoryLink.classList.add('nested-subcategory-item');
            }

            subcategoryLi.appendChild(subcategoryLink);

            // Verifica se esta subcategoria tem subcategorias filhas (apenas se for uma subcategoria)
            if (subcategoriesByParent[sub.id] && subcategoriesByParent[sub.id].length > 0) {
                const hasChildrenAsSubcategory = subcategoriesByParent[sub.id].some(child => child.parentSubcategoryId === sub.id);
                if (hasChildrenAsSubcategory) {
                    const nestedUl = document.createElement('ul');
                    nestedUl.className = 'subcategory-list';
                    subcategoryLi.appendChild(nestedUl);
                    renderSubcategories(sub.id, nestedUl); // Chamada recursiva
                }
            }
            ulElement.appendChild(subcategoryLi);
        });
    };

    // Renderiza categorias de nível superior
    allCategories.sort((a, b) => a.name.localeCompare(b.name)).forEach(category => {
        const categoryLi = document.createElement('li');
        const categoryLink = document.createElement('a');
        categoryLink.href = "#";
        categoryLink.textContent = category.name;
        categoryLink.dataset.categoryId = category.id;
        categoryLink.dataset.subcategoryId = ''; // Indica que é uma categoria, não uma subcategoria específica
        categoryLink.className = 'category-filter-link';

        if (currentFilter.categoryId === category.id && !currentFilter.subcategoryId) {
            categoryLink.classList.add('active');
        }

        categoryLi.appendChild(categoryLink);

        // Adiciona subcategorias de Nível 1 diretamente sob esta categoria
        const level1Subcategories = (subcategoriesByParent[category.id] || []).filter(sub => !sub.parentSubcategoryId && sub.categoryId === category.id);
        if (level1Subcategories.length > 0) {
            const subcategoryUl = document.createElement('ul');
            subcategoryUl.className = 'subcategory-list';
            categoryLi.appendChild(subcategoryUl);
            renderSubcategories(category.id, subcategoryUl); // Inicia a renderização recursiva para subcategorias desta categoria
        }
        categoriesList.appendChild(categoryLi);
    });


    // Adiciona event listeners para os links de categoria e subcategoria
    categoriesList.querySelectorAll('.category-filter-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const categoryId = e.target.dataset.categoryId;
            currentFilter.categoryId = categoryId;
            currentFilter.subcategoryId = null; // Limpa subcategoria ao selecionar nova categoria principal
            renderStoreProducts(allProducts);
            categoriesSidebar.classList.remove('open');
            categoriesOverlay.classList.remove('show');
            categoriesList.querySelectorAll('a').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    categoriesList.querySelectorAll('.subcategory-filter-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const subcategoryId = e.target.dataset.subcategoryId; // Agora filtra diretamente pela subcategoria selecionada
            const categoryId = e.target.dataset.categoryId; // Mantém a categoria para referência
            currentFilter.categoryId = categoryId;
            currentFilter.subcategoryId = subcategoryId;
            renderStoreProducts(allProducts);
            categoriesSidebar.classList.remove('open');
            categoriesOverlay.classList.remove('show');
            categoriesList.querySelectorAll('a').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
}

updateCartCount();
renderCart();