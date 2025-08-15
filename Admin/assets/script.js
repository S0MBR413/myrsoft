import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// Variáveis para armazenar dados do Firestore (Admin)
let allCategories = [];
let allSubcategories = [];

// Função para mostrar mensagem modal
function showMessageModal(message) {
    document.getElementById('messageText').textContent = message;
    document.getElementById('messageModal').classList.add('show');
    document.getElementById('overlay').classList.add('show');
}

// Função para fechar mensagem modal
function closeMessageModal() {
    document.getElementById('messageModal').classList.remove('show');
    document.getElementById('overlay').classList.remove('show');
}

document.getElementById('closeMessageModal').addEventListener('click', closeMessageModal);

// Função para lidar com as mudanças na hash da URL e mostrar/esconder seções
function handleHashChange() {
    const hash = window.location.hash;
    const produtosSection = document.getElementById('produtos');
    const eventosSection = document.getElementById('eventos');
    const categoriasSection = document.getElementById('categorias');

    produtosSection.classList.add('hidden');
    eventosSection.classList.add('hidden');
    categoriasSection.classList.add('hidden');

    if (hash === '#eventos') {
        eventosSection.classList.remove('hidden');
    } else if (hash === '#categorias') {
        categoriasSection.classList.remove('hidden');
    }
    else {
        produtosSection.classList.remove('hidden');
    }
}

window.addEventListener('hashchange', handleHashChange);

// Inicializa Firebase e autenticação
async function initializeFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                document.getElementById('userIdDisplay').textContent = userId;
                document.getElementById('userIdDisplayEvents').textContent = userId;
                document.getElementById('userIdDisplayCategories').textContent = userId;
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
            showMessageModal(`Erro ao carregar o painel admin: ${error.message}. Por favor, **certifique-se de que a Autenticação está ativada (especialmente o método Anônimo)** no seu projeto Firebase Console em "Build > Authentication".`);
            console.warn('Para resolver auth/configuration-not-found, ative a Autenticação (método Anônimo) no seu projeto Firebase Console.');
        } else if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
            showMessageModal(`Erro ao carregar dados: ${error.message}. Por favor, verifique as **Regras de Segurança do Firestore** no seu projeto Firebase Console em "Build > Firestore Database > Rules". Certifique-se de que as permissões de leitura/escrita para 'artifacts/{appId}/public/data/products', 'artifacts/{appId}/public/data/events', 'artifacts/{appId}/public/data/categories' e 'artifacts/{appId}/public/data/subcategories' estão configuradas corretamente para usuários autenticados.`);
            console.warn('Para resolver "Missing or insufficient permissions", configure as Regras de Segurança do Firestore para permitir acesso adequado.');
        }
        else {
            showMessageModal(`Erro ao carregar o painel admin: ${error.message}.`);
        }
    }
}

window.onload = async function () {
    await initializeFirebase();
    handleHashChange();
};

// --- Lógica do Painel Administrativo (Produtos) ---
const productForm = document.getElementById('productForm');
const productNameInput = document.getElementById('productName');
const productDescriptionInput = document.getElementById('productDescription');
const productPriceInput = document.getElementById('productPrice');
const productQuantityInput = document.getElementById('productQuantity');
const productCategorySelect = document.getElementById('productCategory');
const productSubcategorySelect = document.getElementById('productSubcategory');
const productFileInput = document.getElementById('productFile');
const imagePreview = document.getElementById('imagePreview');
let productImageBase64 = null;

const productIdToEditInput = document.getElementById('productIdToEdit');
const adminProductList = document.getElementById('adminProductList');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const loadingProductsMessage = document.getElementById('loadingProductsMessage');

// Event listener para o input de arquivo do produto
productFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 1024 * 1024) {
            showMessageModal('A imagem do produto é muito grande! Por favor, selecione uma imagem com menos de 1MB para evitar problemas no banco de dados.');
            productFileInput.value = '';
            imagePreview.classList.add('hidden');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            productImageBase64 = e.target.result;
            imagePreview.src = productImageBase64;
            imagePreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        productImageBase64 = null;
        imagePreview.classList.add('hidden');
    }
});

// Event listener para carregar subcategorias ao selecionar uma categoria de produto
productCategorySelect.addEventListener('change', () => {
    // Popula o select de subcategorias baseado na categoria selecionada no formulário de produto
    populateProductSubcategorySelect(productCategorySelect.value);
});

// Adicionar/Atualizar produto no Firestore
productForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!isAuthReady) {
        showMessageModal('Autenticação não pronta. Tente novamente em alguns segundos.');
        return;
    }

    const name = productNameInput.value;
    const description = productDescriptionInput.value;
    const price = parseFloat(productPriceInput.value);
    const quantity = parseInt(productQuantityInput.value);
    
    // Obter o ID e nome da categoria
    const selectedCategoryId = productCategorySelect.value;
    const categoryObj = allCategories.find(cat => cat.id === selectedCategoryId);
    const categoryName = categoryObj ? categoryObj.name : '';

    // Obter o ID e nome da subcategoria
    const selectedSubcategoryId = productSubcategorySelect.value;
    const subcategoryObj = allSubcategories.find(sub => sub.id === selectedSubcategoryId);
    const subcategoryName = subcategoryObj ? subcategoryObj.name : '';

    const idToEdit = productIdToEditInput.value;

    if (!name || !description || isNaN(price) || isNaN(quantity) || !categoryName) {
        showMessageModal('Por favor, preencha todos os campos do produto corretamente.');
        return;
    }

    const productData = {
        name,
        description,
        price,
        quantity,
        category: categoryName, // Nome da categoria para exibição
        categoryId: selectedCategoryId, // ID da categoria para referência precisa
        subcategory: subcategoryName, // Nome da subcategoria para exibição
        subcategoryId: selectedSubcategoryId, // ID da subcategoria para referência precisa
        imageData: productImageBase64,
        timestamp: Date.now()
    };

    try {
        const productsCollectionRef = collection(db, `artifacts/${appId}/public/data/products`);
        if (idToEdit) {
            const productRef = doc(db, productsCollectionRef, idToEdit);
            await updateDoc(productRef, productData);
            showMessageModal('Produto atualizado com sucesso!');
        } else {
            await addDoc(productsCollectionRef, productData);
            showMessageModal('Produto adicionado com sucesso!');
        }
        productForm.reset();
        productIdToEditInput.value = '';
        cancelEditBtn.classList.add('hidden');
        productImageBase64 = null;
        imagePreview.classList.add('hidden');
        productFileInput.value = '';
        productSubcategorySelect.innerHTML = '<option value="">Selecione uma subcategoria</option>'; // Limpa subcategorias
    } catch (error) {
        console.error("Erro ao salvar produto:", error);
        showMessageModal(`Erro ao salvar produto: ${error.message}`);
    }
});

// Event listener para cancelar a edição do produto
cancelEditBtn.addEventListener('click', () => {
    productForm.reset();
    productIdToEditInput.value = '';
    cancelEditBtn.classList.add('hidden');
    productImageBase64 = null;
    imagePreview.classList.add('hidden');
    productFileInput.value = '';
    productSubcategorySelect.innerHTML = '<option value="">Selecione uma subcategoria</option>';
});

// --- Lógica do Painel Administrativo (Eventos) ---
const eventForm = document.getElementById('eventForm');
const eventNameInput = document.getElementById('eventName');
const eventDescriptionInput = document.getElementById('eventDescription');
const eventDateInput = document.getElementById('eventDate');
const eventLocationInput = document.getElementById('eventLocation');
const eventLinkInput = document.getElementById('eventLink');
const eventFileInput = document.getElementById('eventFile');
const eventImagePreview = document.getElementById('eventImagePreview');
let eventImageBase64 = null;

const eventIdToEditInput = document.getElementById('eventIdToEdit');
const adminEventList = document.getElementById('adminEventList');
const cancelEventEditBtn = document.getElementById('cancelEventEditBtn');
const loadingEventsMessage = document.getElementById('loadingEventsMessage');

// Event listener para o input de arquivo do evento
eventFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 1024 * 1024) {
            showMessageModal('A imagem do evento é muito grande! Por favor, selecione uma imagem com menos de 1MB para evitar problemas no banco de dados.');
            eventFileInput.value = '';
            eventImagePreview.classList.add('hidden');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            eventImageBase64 = e.target.result;
            eventImagePreview.src = eventImageBase64;
            eventImagePreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        eventImageBase64 = null;
        eventImagePreview.classList.add('hidden');
    }
});

// Adicionar/Atualizar evento no Firestore
eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!isAuthReady) {
        showMessageModal('Autenticação não pronta. Tente novamente em alguns segundos.');
        return;
    }

    const name = eventNameInput.value;
    const description = eventDescriptionInput.value;
    const date = eventDateInput.value;
    const location = eventLocationInput.value;
    const eventLink = eventLinkInput.value;
    const idToEdit = eventIdToEditInput.value;

    if (!name || !description || !date || !location) {
        showMessageModal('Por favor, preencha todos os campos do evento corretamente.');
        return;
    }

    const eventData = {
        name,
        description,
        date,
        location,
        eventLink,
        imageData: eventImageBase64,
        timestamp: Date.now()
    };

    try {
        const eventsCollectionRef = collection(db, `artifacts/${appId}/public/data/events`);
        if (idToEdit) {
            const eventRef = doc(db, eventsCollectionRef, idToEdit);
            await updateDoc(eventRef, eventData);
            showMessageModal('Evento atualizado com sucesso!');
        } else {
            await addDoc(eventsCollectionRef, eventData);
            showMessageModal('Evento adicionado com sucesso!');
        }
        eventForm.reset();
        eventIdToEditInput.value = '';
        cancelEventEditBtn.classList.add('hidden');
        eventImageBase64 = null;
        eventImagePreview.classList.add('hidden');
        eventFileInput.value = '';
    } catch (error) {
        console.error("Erro ao salvar evento:", error);
        showMessageModal(`Erro ao salvar evento: ${error.message}`);
    }
});

// Event listener para cancelar a edição do evento
cancelEventEditBtn.addEventListener('click', () => {
    eventForm.reset();
    eventIdToEditInput.value = '';
    cancelEventEditBtn.classList.add('hidden');
    eventImageBase64 = null;
    eventImagePreview.classList.add('hidden');
    eventFileInput.value = '';
});

// --- Lógica do Painel Administrativo (Categorias e Subcategorias) ---
// Categorias
const categoryForm = document.getElementById('categoryForm');
const categoryNameInput = document.getElementById('categoryName');
const categoryIdToEditInput = document.getElementById('categoryIdToEdit');
const adminCategoryList = document.getElementById('adminCategoryList');
const cancelCategoryEditBtn = document.getElementById('cancelCategoryEditBtn');
const loadingCategoriesMessage = document.getElementById('loadingCategoriesMessage');

// Subcategorias
const subcategoryForm = document.getElementById('subcategoryForm');
const subcategoryNameInput = document.getElementById('subcategoryName');
const parentCategorySelect = document.getElementById('parentCategorySelect');
const parentSubcategorySelect = document.getElementById('parentSubcategorySelect'); // Novo select
const subcategoryIdToEditInput = document.getElementById('subcategoryIdToEdit');
const adminSubcategoryList = document.getElementById('adminSubcategoryList');
const cancelSubcategoryEditBtn = document.getElementById('cancelSubcategoryEditBtn');
const loadingSubcategoriesMessage = document.getElementById('loadingSubcategoriesMessage');

// Event listener para carregar subcategorias-pai ao selecionar uma categoria principal no formulário de subcategoria
parentCategorySelect.addEventListener('change', () => {
    populateParentSubcategorySelect(parentCategorySelect.value);
});

// Adicionar/Atualizar Categoria
categoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAuthReady) {
        showMessageModal('Autenticação não pronta. Tente novamente em alguns segundos.');
        return;
    }
    const name = categoryNameInput.value.trim();
    if (!name) {
        showMessageModal('O nome da categoria não pode ser vazio.');
        return;
    }

    try {
        const categoriesCollectionRef = collection(db, `artifacts/${appId}/public/data/categories`);
        if (categoryIdToEditInput.value) {
            await updateDoc(doc(db, categoriesCollectionRef, categoryIdToEditInput.value), { name, timestamp: Date.now() });
            showMessageModal('Categoria atualizada com sucesso!');
        } else {
            await addDoc(categoriesCollectionRef, { name, timestamp: Date.now() });
            showMessageModal('Categoria adicionada com sucesso!');
        }
        categoryForm.reset();
        categoryIdToEditInput.value = '';
        cancelCategoryEditBtn.classList.add('hidden');
    } catch (error) {
        console.error("Erro ao salvar categoria:", error);
        showMessageModal(`Erro ao salvar categoria: ${error.message}`);
    }
});

// Cancelar edição de Categoria
cancelCategoryEditBtn.addEventListener('click', () => {
    categoryForm.reset();
    categoryIdToEditInput.value = '';
    cancelCategoryEditBtn.classList.add('hidden');
});

// Adicionar/Atualizar Subcategoria
subcategoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAuthReady) {
        showMessageModal('Autenticação não pronta. Tente novamente em alguns segundos.');
        return;
    }
    const name = subcategoryNameInput.value.trim();
    const categoryId = parentCategorySelect.value;
    const parentSubcategoryId = parentSubcategorySelect.value || null; // Pode ser nulo
    
    if (!name || !categoryId) {
        showMessageModal('Por favor, preencha o nome da subcategoria e selecione uma categoria principal.');
        return;
    }

    try {
        const subcategoriesCollectionRef = collection(db, `artifacts/${appId}/public/data/subcategories`);
        const subcategoryData = {
            name,
            categoryId,
            parentSubcategoryId, // Inclui a subcategoria pai
            timestamp: Date.now()
        };

        if (subcategoryIdToEditInput.value) {
            await updateDoc(doc(db, subcategoriesCollectionRef, subcategoryIdToEditInput.value), subcategoryData);
            showMessageModal('Subcategoria atualizada com sucesso!');
        } else {
            await addDoc(subcategoriesCollectionRef, subcategoryData);
            showMessageModal('Subcategoria adicionada com sucesso!');
        }
        subcategoryForm.reset();
        subcategoryIdToEditInput.value = '';
        cancelSubcategoryEditBtn.classList.add('hidden');
        parentSubcategorySelect.innerHTML = '<option value="">Nenhuma subcategoria principal</option>'; // Limpa select de subcategoria pai
    } catch (error) {
        console.error("Erro ao salvar subcategoria:", error);
        showMessageModal(`Erro ao salvar subcategoria: ${error.message}`);
    }
});

// Cancelar edição de Subcategoria
cancelSubcategoryEditBtn.addEventListener('click', () => {
    subcategoryForm.reset();
    subcategoryIdToEditInput.value = '';
    cancelSubcategoryEditBtn.classList.add('hidden');
    parentSubcategorySelect.innerHTML = '<option value="">Nenhuma subcategoria principal</option>';
});


// Função para carregar e renderizar todos os dados no painel admin
function setupFirestoreListeners() {
    if (!isAuthReady) {
        console.warn('Firestore não pronto, aguardando autenticação.');
        return;
    }

    // Listener para produtos
    const productsColRef = collection(db, `artifacts/${appId}/public/data/products`);
    onSnapshot(productsColRef, (snapshot) => {
        const products = [];
        snapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
        });
        renderAdminProducts(products);
    }, (error) => {
        console.error("Erro ao carregar produtos:", error);
        showMessageModal(`Erro ao carregar produtos: ${error.message}. Verifique as regras do Firestore.`);
    });

    // Listener para eventos
    const eventsColRef = collection(db, `artifacts/${appId}/public/data/events`);
    onSnapshot(eventsColRef, (snapshot) => {
        const events = [];
        snapshot.forEach((doc) => {
            events.push({ id: doc.id, ...doc.data() });
        });
        renderAdminEvents(events);
    }, (error) => {
        console.error("Erro ao carregar eventos:", error);
        showMessageModal(`Erro ao carregar eventos: ${error.message}. Verifique as regras do Firestore.`);
    });

    // Listener para categorias
    const categoriesColRef = collection(db, `artifacts/${appId}/public/data/categories`);
    onSnapshot(categoriesColRef, (snapshot) => {
        allCategories = [];
        snapshot.forEach((doc) => {
            allCategories.push({ id: doc.id, ...doc.data() });
        });
        renderAdminCategories(allCategories);
        populateCategoryAndProductCategorySelects(); // Preenche os selects de categoria
    }, (error) => {
        console.error("Erro ao carregar categorias:", error);
        showMessageModal(`Erro ao carregar categorias: ${error.message}. Verifique as regras do Firestore.`);
    });

    // Listener para subcategorias
    const subcategoriesColRef = collection(db, `artifacts/${appId}/public/data/subcategories`);
    onSnapshot(subcategoriesColRef, (snapshot) => {
        allSubcategories = [];
        snapshot.forEach((doc) => {
            allSubcategories.push({ id: doc.id, ...doc.data() });
        });
        renderAdminSubcategories(allSubcategories);
        // populateParentSubcategorySelect é chamado no 'change' de parentCategorySelect
    }, (error) => {
        console.error("Erro ao carregar subcategorias:", error);
        showMessageModal(`Erro ao carregar subcategorias: ${error.message}. Verifique as regras do Firestore.`);
    });
}

/**
 * Função auxiliar para obter o caminho completo da subcategoria.
 * @param {string} subcategoryId - O ID da subcategoria.
 * @returns {string} O caminho completo da subcategoria (ex: 'Categoria > Subcat1 > Subcat2').
 */
function getSubcategoryFullPath(subcategoryId) {
    let path = [];
    let currentSub = allSubcategories.find(s => s.id === subcategoryId);
    // Build the path from child to parent
    while (currentSub) {
        path.unshift(currentSub.name);
        currentSub = allSubcategories.find(s => s.id === currentSub.parentSubcategoryId);
    }
    // Add the main category name at the beginning of the path
    const mainCategory = allCategories.find(cat => cat.id === allSubcategories.find(s => s.id === subcategoryId)?.categoryId);
    if (mainCategory) {
        path.unshift(mainCategory.name);
    }
    return path.join(' > ');
}

/**
 * Renderiza os produtos na lista do painel administrativo.
 * @param {Array<object>} products - Array de objetos de produto.
 */
function renderAdminProducts(products) {
    adminProductList.innerHTML = '';
    loadingProductsMessage.classList.add('hidden');

    if (products.length === 0) {
        adminProductList.innerHTML = '<p class="text-gray-500 text-center">Nenhum produto cadastrado.</p>';
        return;
    }

    products.forEach(product => {
        const productItem = document.createElement('div');
        productItem.className = 'flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 rounded-lg shadow-sm';
        const imagePreviewSrc = product.imageData && product.imageData.trim() !== '' ? product.imageData : `https://placehold.co/80x80/e0e0e0/000000?text=Sem+Img`;
        
        // Get the full category/subcategory path for display
        let fullPath = product.category; // Start with the main category
        if (product.subcategoryId) { // Check if a specific subcategory ID is present
            const subcategoryPath = getSubcategoryFullPath(product.subcategoryId);
            // Remove the main category name if it's already there to avoid duplication
            if (subcategoryPath.startsWith(product.category + ' > ')) {
                fullPath = subcategoryPath;
            } else if (subcategoryPath) {
                fullPath = `${product.category} > ${subcategoryPath.split(' > ').slice(1).join(' > ')}`; // Rebuild if category is not part of subcategory path
            }
        }

        productItem.innerHTML = `
            <div class="flex-1 mb-2 sm:mb-0 flex items-start">
                <img src="${imagePreviewSrc}" onerror="this.onerror=null;this.src='https://placehold.co/80x80/e0e0e0/000000?text=Erro';" alt="Pré-visualização" class="w-16 h-16 object-cover rounded mr-4">
                <div>
                    <h4 class="font-semibold text-lg">${product.name}</h4>
                    <p class="text-sm text-gray-600">${product.description}</p>
                    <p class="text-md font-medium text-red-600">R$ ${product.price.toFixed(2)}</p>
                    <p class="text-gray-500 text-xs">Quantidade: ${product.quantity}</p>
                    <p class="text-gray-500 text-xs">Caminho: ${fullPath}</p>
                </div>
            </div>
            <div class="flex space-x-2">
                <button class="edit-product-btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded-full text-sm" data-product-id="${product.id}">Editar</button>
                <button class="delete-product-btn bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-full text-sm" data-product-id="${product.id}">Excluir</button>
            </div>
        `;
        adminProductList.appendChild(productItem);
    });

    adminProductList.querySelectorAll('.edit-product-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            const productToEdit = products.find(p => p.id === productId);
            if (productToEdit) {
                productNameInput.value = productToEdit.name;
                productDescriptionInput.value = productToEdit.description;
                productPriceInput.value = productToEdit.price;
                productQuantityInput.value = productToEdit.quantity;
                
                // Select the category based on categoryId
                if (productToEdit.categoryId) {
                    productCategorySelect.value = productToEdit.categoryId;
                    // Populate subcategories and then select the subcategory of the product using its ID
                    populateProductSubcategorySelect(productToEdit.categoryId, productToEdit.subcategoryId);
                } else {
                    productCategorySelect.value = '';
                    productSubcategorySelect.innerHTML = '<option value="">Selecione uma subcategoria</option>';
                }

                if (productToEdit.imageData) {
                    productImageBase64 = productToEdit.imageData;
                    imagePreview.src = productImageBase64;
                    imagePreview.classList.remove('hidden');
                } else {
                    productImageBase64 = null;
                    imagePreview.classList.add('hidden');
                }
                productFileInput.value = '';
                productIdToEditInput.value = productToEdit.id;
                cancelEditBtn.classList.remove('hidden');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });

    adminProductList.querySelectorAll('.delete-product-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const productId = event.target.dataset.productId;
            const confirmDelete = await new Promise(resolve => {
                showMessageModal('Tem certeza que deseja excluir este produto?', true, resolve);
                document.getElementById('messageModal').innerHTML += `
                    <div class="mt-4 flex space-x-4">
                        <button id="confirmDeleteBtn" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full">Confirmar</button>
                        <button id="cancelDeleteBtn" class="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-full">Cancelar</button>
                    </div>
                `;
                document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
                    closeMessageModal();
                    resolve(true);
                });
                document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
                    closeMessageModal();
                    resolve(false);
                });
            });

            if (confirmDelete) {
                try {
                    if (!isAuthReady) {
                        showMessageModal('Autenticação não pronta. Tente novamente em alguns segundos.');
                        return;
                    }
                    await deleteDoc(doc(db, `artifacts/${appId}/public/data/products`, productId));
                    showMessageModal('Produto excluído com sucesso!');
                } catch (error) {
                    console.error("Erro ao excluir produto:", error);
                    showMessageModal(`Erro ao excluir produto: ${error.message}`);
                }
            }
        });
    });
}

/**
 * Renderiza os eventos na lista do painel administrativo.
 * @param {Array<object>} events - Array de objetos de evento.
 */
function renderAdminEvents(events) {
    adminEventList.innerHTML = '';
    loadingEventsMessage.classList.add('hidden');

    if (events.length === 0) {
        adminEventList.innerHTML = '<p class="text-gray-500 text-center">Nenhum evento cadastrado.</p>';
        return;
    }

    events.forEach(event => {
        const eventItem = document.createElement('div');
        eventItem.className = 'flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 rounded-lg shadow-sm';
        const imagePreviewSrc = event.imageData && event.imageData.trim() !== '' ? event.imageData : `https://placehold.co/80x80/e0e0e0/000000?text=Sem+Img`;
        
        eventItem.innerHTML = `
            <div class="flex-1 mb-2 sm:mb-0 flex items-start">
                <img src="${imagePreviewSrc}" onerror="this.onerror=null;this.src='https://placehold.co/80x80/e0e0e0/000000?text=Erro';" alt="Pré-visualização" class="w-16 h-16 object-cover rounded mr-4">
                <div>
                    <h4 class="font-semibold text-lg">${event.name}</h4>
                    <p class="text-sm text-gray-600">${event.description}</p>
                    <p class="text-gray-500 text-xs">Data: ${new Date(event.date).toLocaleDateString('pt-BR')}</p>
                    <p class="text-gray-500 text-xs">Local: ${event.location}</p>
                    ${event.eventLink ? `<p class="text-gray-500 text-xs break-all">Link: <a href="${event.eventLink}" target="_blank" class="text-blue-500 hover:underline">${event.eventLink}</a></p>` : ''}
                </div>
            </div>
            <div class="flex space-x-2">
                <button class="edit-event-btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded-full text-sm" data-event-id="${event.id}">Editar</button>
                <button class="delete-event-btn bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-full text-sm" data-event-id="${event.id}">Excluir</button>
            </div>
        `;
        adminEventList.appendChild(eventItem);
    });

    adminEventList.querySelectorAll('.edit-event-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const eventId = e.target.dataset.eventId;
            const eventToEdit = events.find(event => event.id === eventId);
            if (eventToEdit) {
                eventNameInput.value = eventToEdit.name;
                eventDescriptionInput.value = eventToEdit.description;
                eventDateInput.value = eventToEdit.date;
                eventLocationInput.value = eventToEdit.location;
                eventLinkInput.value = eventToEdit.eventLink || '';
                
                if (eventToEdit.imageData) {
                    eventImageBase64 = eventToEdit.imageData;
                    eventImagePreview.src = eventImageBase64;
                    eventImagePreview.classList.remove('hidden');
                } else {
                    eventImageBase64 = null;
                    eventImagePreview.classList.add('hidden');
                }
                eventFileInput.value = '';
                eventIdToEditInput.value = eventToEdit.id;
                cancelEventEditBtn.classList.remove('hidden');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });

    adminEventList.querySelectorAll('.delete-event-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const eventId = e.target.dataset.eventId;
            const confirmDelete = await new Promise(resolve => {
                showMessageModal('Tem certeza que deseja excluir este evento?', true, resolve);
                document.getElementById('messageModal').innerHTML += `
                    <div class="mt-4 flex space-x-4">
                        <button id="confirmDeleteBtn" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full">Confirmar</button>
                        <button id="cancelDeleteBtn" class="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-full">Cancelar</button>
                    </div>
                `;
                document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
                    closeMessageModal();
                    resolve(true);
                });
                document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
                    closeMessageModal();
                    resolve(false);
                });
            });

            if (confirmDelete) {
                try {
                    if (!isAuthReady) {
                        showMessageModal('Autenticação não pronta. Tente novamente em alguns segundos.');
                        return;
                    }
                    await deleteDoc(doc(db, `artifacts/${appId}/public/data/events`, eventId));
                    showMessageModal('Evento excluído com sucesso!');
                } catch (error) {
                    console.error("Erro ao excluir evento:", error);
                    showMessageModal(`Erro ao excluir evento: ${error.message}`);
                }
            }
        });
    });
}

/**
 * Renderiza a lista de categorias no painel administrativo.
 * @param {Array<object>} categories - Array de objetos de categoria.
 */
function renderAdminCategories(categories) {
    adminCategoryList.innerHTML = '';
    loadingCategoriesMessage.classList.add('hidden');

    if (categories.length === 0) {
        adminCategoryList.innerHTML = '<p class="text-gray-500 text-center">Nenhuma categoria cadastrada.</p>';
        return;
    }

    categories.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg shadow-sm';
        categoryItem.innerHTML = `
            <div class="flex-1">
                <h4 class="font-semibold text-lg">${category.name}</h4>
            </div>
            <div class="flex space-x-2">
                <button class="edit-category-btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded-full text-sm" data-category-id="${category.id}">Editar</button>
                <button class="delete-category-btn bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-full text-sm" data-category-id="${category.id}">Excluir</button>
            </div>
        `;
        adminCategoryList.appendChild(categoryItem);
    });

    adminCategoryList.querySelectorAll('.edit-category-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const categoryId = e.target.dataset.categoryId;
            const categoryToEdit = allCategories.find(c => c.id === categoryId);
            if (categoryToEdit) {
                categoryNameInput.value = categoryToEdit.name;
                categoryIdToEditInput.value = categoryToEdit.id;
                cancelCategoryEditBtn.classList.remove('hidden');
                window.scrollTo({ top: document.getElementById('categoryForm').offsetTop, behavior: 'smooth' });
            }
        });
    });

    adminCategoryList.querySelectorAll('.delete-category-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const categoryId = e.target.dataset.categoryId;
            const confirmDelete = await new Promise(resolve => {
                showMessageModal('Tem certeza que deseja excluir esta categoria? Isso também removerá subcategorias e desvinculará produtos.', true, resolve);
                document.getElementById('messageModal').innerHTML += `
                    <div class="mt-4 flex space-x-4">
                        <button id="confirmDeleteBtn" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full">Confirmar</button>
                        <button id="cancelDeleteBtn" class="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-full">Cancelar</button>
                    </div>
                `;
                document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
                    closeMessageModal();
                    resolve(true);
                });
                document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
                    closeMessageModal();
                    resolve(false);
                });
            });

            if (confirmDelete) {
                try {
                    // Encontra subcategorias relacionadas e as exclui
                    const relatedSubcategories = allSubcategories.filter(sub => sub.categoryId === categoryId);
                    for (const sub of relatedSubcategories) {
                        await deleteDoc(doc(db, `artifacts/${appId}/public/data/subcategories`, sub.id));
                    }

                    // Remove o nome da categoria e subcategoria dos produtos relacionados
                    const productsToUpdate = (await getDocs(query(collection(db, `artifacts/${appId}/public/data/products`), where('categoryId', '==', categoryId)))).docs; // Use categoryId here
                    for (const productDoc of productsToUpdate) {
                        await updateDoc(doc(db, `artifacts/${appId}/public/data/products`, productDoc.id), {
                            category: '',
                            categoryId: '', // Clear categoryId as well
                            subcategory: '',
                            subcategoryId: '' // Clear subcategoryId as well
                        });
                    }

                    await deleteDoc(doc(db, `artifacts/${appId}/public/data/categories`, categoryId));
                    showMessageModal('Categoria e subcategorias relacionadas excluídas com sucesso, e produtos desvinculados!');
                } catch (error) {
                    console.error("Erro ao excluir categoria:", error);
                    showMessageModal(`Erro ao excluir categoria: ${error.message}`);
                }
            }
        });
    });
}

/**
 * Renderiza a lista de subcategorias no painel administrativo.
 * @param {Array<object>} subcategories - Array de objetos de subcategoria.
 */
function renderAdminSubcategories(subcategories) {
    adminSubcategoryList.innerHTML = '';
    loadingSubcategoriesMessage.classList.add('hidden');

    if (subcategories.length === 0) {
        adminSubcategoryList.innerHTML = '<p class="text-gray-500 text-center">Nenhuma subcategoria cadastrada.</p>';
        return;
    }

    subcategories.forEach(subcategory => {
        // Use getSubcategoryFullPath to display the full path
        const subcategoryPath = getSubcategoryFullPath(subcategory.id);

        const subcategoryItem = document.createElement('div');
        subcategoryItem.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg shadow-sm';
        subcategoryItem.innerHTML = `
            <div class="flex-1">
                <h4 class="font-semibold text-lg">${subcategory.name}</h4>
                <p class="text-sm text-gray-600">Caminho: ${subcategoryPath}</p>
            </div>
            <div class="flex space-x-2">
                <button class="edit-subcategory-btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded-full text-sm" data-subcategory-id="${subcategory.id}">Editar</button>
                <button class="delete-subcategory-btn bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-full text-sm" data-subcategory-id="${subcategory.id}">Excluir</button>
            </div>
        `;
        adminSubcategoryList.appendChild(subcategoryItem);
    });

    adminSubcategoryList.querySelectorAll('.edit-subcategory-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const subcategoryId = e.target.dataset.subcategoryId;
            const subcategoryToEdit = allSubcategories.find(s => s.id === subcategoryId);
            if (subcategoryToEdit) {
                subcategoryNameInput.value = subcategoryToEdit.name;
                parentCategorySelect.value = subcategoryToEdit.categoryId;
                // Popula o select de subcategorias pai antes de tentar selecionar
                populateParentSubcategorySelect(subcategoryToEdit.categoryId, subcategoryToEdit.parentSubcategoryId);
                subcategoryIdToEditInput.value = subcategoryToEdit.id;
                cancelSubcategoryEditBtn.classList.remove('hidden');
                window.scrollTo({ top: document.getElementById('subcategoryForm').offsetTop, behavior: 'smooth' });
            }
        });
    });

    adminSubcategoryList.querySelectorAll('.delete-subcategory-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const subcategoryId = e.target.dataset.subcategoryId;
            const confirmDelete = await new Promise(resolve => {
                showMessageModal('Tem certeza que deseja excluir esta subcategoria? Isso também desvinculará produtos.', true, resolve);
                document.getElementById('messageModal').innerHTML += `
                    <div class="mt-4 flex space-x-4">
                        <button id="confirmDeleteBtn" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full">Confirmar</button>
                        <button id="cancelDeleteBtn" class="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-full">Cancelar</button>
                    </div>
                `;
                document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
                    closeMessageModal();
                    resolve(true);
                });
                document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
                    closeMessageModal();
                    resolve(false);
                });
            });

            if (confirmDelete) {
                try {
                    // Desvincular produtos diretamente ligados a esta subcategoria
                    const productsToUpdate = (await getDocs(query(collection(db, `artifacts/${appId}/public/data/products`), where('subcategoryId', '==', subcategoryId)))).docs; // Use subcategoryId here
                    for (const productDoc of productsToUpdate) {
                        await updateDoc(doc(db, `artifacts/${appId}/public/data/products`, productDoc.id), {
                            subcategory: '',
                            subcategoryId: '' // Clear subcategoryId
                        });
                    }
                    // Também desvincular subcategorias que usam esta como pai
                    const childSubcategoriesToUpdate = allSubcategories.filter(sub => sub.parentSubcategoryId === subcategoryId);
                    for (const childSub of childSubcategoriesToUpdate) {
                        await updateDoc(doc(db, `artifacts/${appId}/public/data/subcategories`, childSub.id), {
                            parentSubcategoryId: null // Remove a referência ao pai
                        });
                    }

                    await deleteDoc(doc(db, `artifacts/${appId}/public/data/subcategories`, subcategoryId));
                    showMessageModal('Subcategoria excluída com sucesso, e produtos e subcategorias filhas desvinculados!');
                } catch (error) {
                    console.error("Erro ao excluir subcategoria:", error);
                    showMessageModal(`Erro ao excluir subcategoria: ${error.message}`);
                }
            }
        });
    });
}

/**
 * Preenche os selects de categoria (no formulário de produto e subcategoria).
 */
function populateCategoryAndProductCategorySelects() {
    // Preenche o select de categoria do formulário de produto
    productCategorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';
    allCategories.sort((a, b) => a.name.localeCompare(b.name)).forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        productCategorySelect.appendChild(option);
    });

    // Preenche o select de categoria do formulário de subcategoria
    parentCategorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';
    allCategories.sort((a, b) => a.name.localeCompare(b.name)).forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        parentCategorySelect.appendChild(option);
    });
}

/**
 * Preenche o select de subcategoria para o formulário de produto.
 * @param {string} selectedCategoryId - O ID da categoria selecionada.
 * @param {string} [selectedSubcategoryIdToPreselect=''] - O ID da subcategoria a ser pré-selecionada.
 */
function populateProductSubcategorySelect(selectedCategoryId, selectedSubcategoryIdToPreselect = '') {
    productSubcategorySelect.innerHTML = '<option value="">Selecione uma subcategoria</option>';

    if (selectedCategoryId) {
        // Filtra todas as subcategorias que pertencem à categoria selecionada
        const relatedSubcategories = allSubcategories.filter(sub => sub.categoryId === selectedCategoryId);

        // Adiciona as subcategorias ao select, com seus caminhos completos para clareza
        relatedSubcategories.sort((a, b) => {
            const pathA = getSubcategoryFullPath(a.id);
            const pathB = getSubcategoryFullPath(b.id);
            return pathA.localeCompare(pathB);
        }).forEach(sub => {
            const option = document.createElement('option');
            option.value = sub.id; // Salva o ID da subcategoria
            // Exibe o caminho completo da subcategoria no dropdown (excluindo o nome da categoria principal se já estiver no path)
            let displayPath = getSubcategoryFullPath(sub.id);
            const mainCategoryName = allCategories.find(c => c.id === selectedCategoryId)?.name;
            if (mainCategoryName && displayPath.startsWith(mainCategoryName + ' > ')) {
                displayPath = displayPath.substring(mainCategoryName.length + 3); // Remove "Category Name > "
            }
            option.textContent = displayPath;
            
            if (sub.id === selectedSubcategoryIdToPreselect) {
                option.selected = true;
            }
            productSubcategorySelect.appendChild(option);
        });
    }
}

/**
 * Preenche o select de subcategorias pai (apenas subcategorias de Nível 1) no formulário de subcategoria.
 * @param {string} selectedCategoryId - O ID da categoria principal selecionada.
 * @param {string} [selectedParentSubcategoryId=''] - O ID da subcategoria pai a ser pré-selecionada.
 */
function populateParentSubcategorySelect(selectedCategoryId, selectedParentSubcategoryId = '') {
    parentSubcategorySelect.innerHTML = '<option value="">Nenhuma subcategoria principal</option>'; // Opção padrão

    if (selectedCategoryId) {
        // Filtra apenas subcategorias que pertencem à categoria selecionada
        // E que não são filhas de outra subcategoria (são de primeiro nível de subcategoria)
        const level1Subcategories = allSubcategories.filter(sub => 
            sub.categoryId === selectedCategoryId && !sub.parentSubcategoryId
        );

        level1Subcategories.sort((a, b) => a.name.localeCompare(b.name)).forEach(sub => {
            const option = document.createElement('option');
            option.value = sub.id;
            option.textContent = sub.name;
            if (sub.id === selectedParentSubcategoryId) {
                option.selected = true;
            }
            parentSubcategorySelect.appendChild(option);
        });
    }
}