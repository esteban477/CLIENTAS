import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, doc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'; // Added PieChart, Pie, Cell

// Componente principal de la aplicación
const App = () => {
    // Estados para Firebase
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true); // Estado de carga para Firebase

    // Efecto para inicializar Firebase y autenticación
    useEffect(() => {
        const initializeFirebase = async () => {
            try {
                // Configuración de Firebase (proporcionada por el entorno Canvas)
                const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
                const app = initializeApp(firebaseConfig);
                const firestoreDb = getFirestore(app);
                const firebaseAuth = getAuth(app);

                setDb(firestoreDb);
                setAuth(firebaseAuth);

                // Listener para cambios en el estado de autenticación
                const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                    if (user) {
                        // Si hay un usuario autenticado, obtenemos su UID
                        setUserId(user.uid);
                    } else {
                        // Si no hay usuario, intentamos autenticar con token o de forma anónima
                        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                            await signInWithCustomToken(firebaseAuth, __initial_auth_token);
                        } else {
                            await signInAnonymously(firebaseAuth);
                        }
                    }
                    setLoading(false); // La carga termina una vez que se determina el estado de autenticación
                });

                // Función de limpieza para desuscribirse del listener
                return () => unsubscribe();
            } catch (error) {
                console.error("Error al inicializar Firebase:", error);
                setLoading(false); // Si hay un error, la carga también debe terminar
            }
        };

        initializeFirebase();
    }, []); // Se ejecuta solo una vez al montar el componente

    // Muestra una pantalla de carga mientras Firebase se inicializa
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-pink-400 to-purple-500 text-white text-2xl font-bold">
                Cargando DyC Cosméticos...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-pink-50 flex flex-col font-sans">
            {/* Barra de navegación */}
            <nav className="bg-gradient-to-r from-pink-500 to-purple-600 p-4 shadow-lg">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-white text-3xl font-bold rounded-lg p-2 transform transition-transform duration-300 hover:scale-105">
                        DyC Cosméticos
                    </h1>
                </div>
            </nav>

            {/* Contenido principal: La única sección de gestión */}
            <main className="flex-grow container mx-auto p-8 flex items-start justify-center">
                <CosmeticsManagementPage db={db} auth={auth} userId={userId} />
            </main>

            {/* Pie de página */}
            <footer className="bg-gray-800 text-white p-6 text-center shadow-inner">
                <div className="container mx-auto">
                    <p className="text-sm">
                        &copy; {new Date().getFullYear()} DyC Cosméticos. Todos los derechos reservados.
                    </p>
                    {userId && (
                        <p className="text-xs mt-2">
                            ID de Usuario: <span className="font-mono text-pink-300">{userId}</span>
                        </p>
                    )}
                    <p className="text-xs mt-2">
                        Hecho con ❤️ y React.
                    </p>
                </div>
            </footer>
        </div>
    );
};

// Componente principal para la gestión de cosméticos (clientes, pedidos, pagos)
const CosmeticsManagementPage = ({ db, auth, userId }) => {
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [newClientName, setNewClientName] = useState('');
    const [newClientCelular, setNewClientCelular] = useState(''); // New state for phone number
    const [loadingClients, setLoadingClients] = useState(true);

    const [orders, setOrders] = useState([]);
    const [newOrderDescription, setNewOrderDescription] = useState('');
    const [newOrderAmount, setNewOrderAmount] = useState('');
    const [newOrderDate, setNewOrderDate] = useState(new Date().toISOString().split('T')[0]); // Current date

    const [payments, setPayments] = useState([]);
    const [newPaymentAmount, setNewPaymentAmount] = useState('');
    const [newPaymentDate, setNewPaymentDate] = useState(new Date().toISOString().split('T')[0]); // Current date

    // New states for city management
    const [cities, setCities] = useState([]);
    const [selectedCity, setSelectedCity] = useState('');
    const [newClientCityInput, setNewClientCityInput] = useState(''); // For new city input
    const [showNewCityInput, setShowNewCityInput] = useState(false); // To show/hide new city input

    // Client editing state
    const [editingClient, setEditingClient] = useState(null);
    const [editClientName, setEditClientName] = useState('');
    const [editClientCity, setEditClientCity] = useState('');
    const [editClientCelular, setEditClientCelular] = useState(''); // State for editing phone number
    const [showEditNewCityInput, setShowEditNewCityInput] = useState(false); // To show/hide new city input in edit mode

    // Order and payment editing states
    const [editingOrder, setEditingOrder] = useState(null);
    const [editOrderDescription, setEditOrderDescription] = useState('');
    const [editOrderAmount, setEditOrderAmount] = useState('');
    const [editOrderDate, setEditOrderDate] = useState('');

    const [editingPayment, setEditingPayment] = useState(null);
    const [editPaymentAmount, setEditPaymentAmount] = useState('');
    const [editPaymentDate, setEditPaymentDate] = useState('');

    // Client filter states
    const [filterCity, setFilterCity] = useState('');
    const [searchName, setSearchName] = useState('');

    // State for client actions dropdown menu
    const [showClientActionsDropdown, setShowClientActionsDropdown] = useState(false);
    const dropdownRef = useRef(null); // Ref to detect clicks outside the dropdown

    // State for current view: 'clients' or 'reports'
    const [currentView, setCurrentView] = useState('clients');

    // Effect to close the dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowClientActionsDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    // Effect to get clients from Firestore in real-time and sort them alphabetically
    useEffect(() => {
        if (!db || !userId) return;

        const clientsCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/clients`);
        const q = query(clientsCollectionRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Apply city filter
            if (filterCity) {
                clientsData = clientsData.filter(client => client.city === filterCity);
            }

            // Apply name filter
            if (searchName) {
                clientsData = clientsData.filter(client =>
                    client.name.toLowerCase().includes(searchName.toLowerCase())
                );
            }

            // Sort clients alphabetically by name
            clientsData.sort((a, b) => a.name.localeCompare(b.name));
            setClients(clientsData);
            setLoadingClients(false);
            // If the selected client no longer exists, deselect them
            if (selectedClient && !clientsData.some(client => client.id === selectedClient.id)) {
                setSelectedClient(null);
            }
        }, (error) => {
            console.error("Error al obtener clientes:", error);
            setLoadingClients(false);
        });

        return () => unsubscribe();
    }, [db, userId, selectedClient, filterCity, searchName]); // Filter dependencies

    // Effect to get cities from Firestore in real-time
    useEffect(() => {
        if (!db || !userId) return;

        const citiesCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/cities`);
        const q = query(citiesCollectionRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const citiesData = snapshot.docs.map(doc => doc.data().name);
            citiesData.sort((a, b) => a.localeCompare(b)); // Sort cities alphabetically
            setCities(citiesData);
        }, (error) => {
            console.error("Error al obtener ciudades:", error);
        });

        return () => unsubscribe();
    }, [db, userId]);

    // Effect to get orders for the selected client in real-time
    useEffect(() => {
        if (!db || !userId || !selectedClient) {
            setOrders([]); // Clear orders if no client is selected
            return;
        }

        const ordersCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/clients/${selectedClient.id}/orders`);
        const q = query(ordersCollectionRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setOrders(ordersData);
        }, (error) => {
            console.error("Error al obtener pedidos:", error);
        });

        return () => unsubscribe();
    }, [db, userId, selectedClient]);

    // Effect to get payments for the selected client in real-time
    useEffect(() => {
        if (!db || !userId || !selectedClient) {
            setPayments([]); // Clear payments if no client is selected
            return;
        }

        const paymentsCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/clients/${selectedClient.id}/payments`);
        const q = query(paymentsCollectionRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const paymentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPayments(paymentsData);
        }, (error) => {
            console.error("Error al obtener pagos:", error);
        });

        return () => unsubscribe();
    }, [db, userId, selectedClient]);

    // Function to update client balance
    const updateClientBalance = async (clientId, amountChange) => {
        if (!db || !userId || !clientId) return;
        const clientRef = doc(db, `artifacts/${__app_id}/users/${userId}/clients/${clientId}`);
        try {
            const clientDoc = await getDoc(clientRef);
            if (clientDoc.exists()) {
                const currentBalance = clientDoc.data().balance || 0;
                await updateDoc(clientRef, {
                    balance: currentBalance + amountChange
                });
            }
        } catch (e) {
            console.error("Error al actualizar el saldo del cliente: ", e);
        }
    };

    // Function to add a new city if it doesn't exist
    const addCityIfNotExists = async (cityName) => {
        if (!db || !userId || !cityName.trim()) return;
        const citiesCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/cities`);
        const q = query(citiesCollectionRef);
        const querySnapshot = await getDocs(q);
        const existingCities = querySnapshot.docs.map(doc => doc.data().name.toLowerCase());

        if (!existingCities.includes(cityName.trim().toLowerCase())) {
            await addDoc(citiesCollectionRef, { name: cityName.trim() });
            console.log(`Ciudad '${cityName.trim()}' añadida.`);
        }
    };

    // Function to add a new client
    const addClient = async () => {
        if (!db || !userId || !newClientName.trim()) {
            console.error("Faltan datos para añadir cliente (nombre es obligatorio).");
            return;
        }

        let clientCity = '';
        if (showNewCityInput) {
            if (!newClientCityInput.trim()) {
                console.error("Por favor, ingresa el nombre de la nueva ciudad.");
                return;
            }
            clientCity = newClientCityInput.trim();
            await addCityIfNotExists(clientCity); // Ensure the new city is saved
        } else {
            // If no city was selected and no new one was added, the city can be empty
            clientCity = selectedCity;
        }

        try {
            const clientsCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/clients`);
            await addDoc(clientsCollectionRef, {
                name: newClientName.trim(),
                city: clientCity, // Save the city with the client (can be empty)
                celular: newClientCelular.trim(), // Save the phone number (can be empty)
                createdAt: new Date().toISOString(),
                balance: 0 // Initial balance
            });
            setNewClientName('');
            setNewClientCelular(''); // Clear phone number field
            setSelectedCity('');
            setNewClientCityInput('');
            setShowNewCityInput(false);
            console.log("Cliente añadido con éxito!");
        } catch (e) {
            console.error("Error al añadir cliente: ", e);
        }
    };

    // Function to start client editing
    const handleEditClient = (client) => {
        setEditingClient(client);
        setEditClientName(client.name);
        setEditClientCity(client.city);
        setEditClientCelular(client.celular || ''); // Load existing phone number
        setShowEditNewCityInput(!cities.includes(client.city)); // Show input if city is not in the list
        setShowClientActionsDropdown(false); // Close dropdown when opening modal (if opened from dropdown)
    };

    // Function to save edited client changes
    const saveEditedClient = async () => {
        if (!db || !userId || !editingClient || !editClientName.trim()) {
            console.error("Faltan datos para guardar cliente editado.");
            return;
        }

        let clientCity = '';
        if (showEditNewCityInput) {
            if (!newClientCityInput.trim()) {
                console.error("Por favor, ingresa el nombre de la nueva ciudad para la edición.");
                return;
            }
            clientCity = newClientCityInput.trim();
            await addCityIfNotExists(clientCity);
        } else {
            // If no city was selected and no new one was added, the city can be empty
            clientCity = editClientCity;
        }

        try {
            const clientRef = doc(db, `artifacts/${__app_id}/users/${userId}/clients/${editingClient.id}`);
            await updateDoc(clientRef, {
                name: editClientName.trim(),
                city: clientCity,
                celular: editClientCelular.trim()
            });
            setEditingClient(null); // Close the edit form
            setNewClientCityInput(''); // Clear new city input
            console.log("Cliente editado con éxito!");
        } catch (e) {
            console.error("Error al guardar cliente editado: ", e);
        }
    };

    // Function to delete a client
    const deleteClient = async (clientId) => {
        if (!db || !userId || !clientId) {
            console.error("No se puede eliminar el cliente. ID no proporcionado.");
            return;
        }

        // Visual confirmation before deleting
        if (!window.confirm('¿Estás seguro de que quieres eliminar este cliente y todos sus pedidos y pagos asociados? Esta acción es irreversible.')) {
            return;
        }

        try {
            // First, delete all client's orders
            const ordersCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/clients/${clientId}/orders`);
            const ordersSnapshot = await getDocs(ordersCollectionRef);
            for (const orderDoc of ordersSnapshot.docs) {
                await deleteDoc(doc(db, `artifacts/${__app_id}/users/${userId}/clients/${clientId}/orders`, orderDoc.id));
            }

            // Then, delete all client's payments
            const paymentsCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/clients/${clientId}/payments`);
            const paymentsSnapshot = await getDocs(paymentsCollectionRef);
            for (const paymentDoc of paymentsSnapshot.docs) {
                await deleteDoc(doc(db, `artifacts/${__app_id}/users/${userId}/clients/${clientId}/payments`, paymentDoc.id));
            }

            // Finally, delete the client document
            const clientRef = doc(db, `artifacts/${__app_id}/users/${userId}/clients/${clientId}`);
            await deleteDoc(clientRef);

            setSelectedClient(null); // Deselect the client if it was deleted
            setShowClientActionsDropdown(false); // Close dropdown
            console.log("Cliente y sus datos asociados eliminados con éxito!");
        } catch (e) {
            console.error("Error al eliminar cliente: ", e);
        }
    };

    // Function to add a new order
    const addOrder = async () => {
        let missingFields = [];
        if (!newOrderDescription.trim()) missingFields.push("Descripción del Pedido");
        if (!newOrderAmount) missingFields.push("Monto del Pedido");
        if (!newOrderDate) missingFields.push("Fecha del Pedido");

        if (missingFields.length > 0) {
            console.error(`Faltan los siguientes datos para añadir pedido: ${missingFields.join(', ')}.`);
            return;
        }
        if (!db || !userId || !selectedClient) {
            console.error("No se puede añadir pedido: Faltan datos de la aplicación o cliente seleccionado.");
            return;
        }

        const amount = parseFloat(newOrderAmount);
        if (isNaN(amount) || amount <= 0) {
            console.error("Monto de pedido inválido.");
            return;
        }

        try {
            const ordersCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/clients/${selectedClient.id}/orders`);
            await addDoc(ordersCollectionRef, {
                description: newOrderDescription.trim(),
                amount: amount,
                orderDate: newOrderDate,
                createdAt: new Date().toISOString()
            });
            await updateClientBalance(selectedClient.id, -amount); // Decrease balance by order amount
            setNewOrderDescription('');
            setNewOrderAmount('');
            setNewOrderDate(new Date().toISOString().split('T')[0]);
            console.log("Pedido añadido con éxito!");
        } catch (e) {
            console.error("Error al añadir pedido: ", e);
        }
    };

    // Function to start order editing
    const handleEditOrder = (order) => {
        setEditingOrder(order);
        setEditOrderDescription(order.description);
        setEditOrderAmount(order.amount.toString());
        setEditOrderDate(order.orderDate);
    };

    // Function to save edited order changes
    const saveEditedOrder = async () => {
        if (!db || !userId || !editingOrder || !selectedClient || !editOrderDescription.trim() || !editOrderAmount || !editOrderDate) {
            console.error("Faltan datos para guardar pedido editado.");
            return;
        }
        const newAmount = parseFloat(editOrderAmount);
        if (isNaN(newAmount) || newAmount <= 0) {
            console.error("Monto de pedido inválido.");
            return;
        }

        try {
            const orderRef = doc(db, `artifacts/${__app_id}/users/${userId}/clients/${selectedClient.id}/orders/${editingOrder.id}`);
            const oldAmount = editingOrder.amount;
            const amountChange = oldAmount - newAmount; // If new amount is less, client owes less, balance increases. If more, owes more, balance decreases.

            await updateDoc(orderRef, {
                description: editOrderDescription.trim(),
                amount: newAmount,
                orderDate: editOrderDate
            });
            await updateClientBalance(selectedClient.id, amountChange);
            setEditingOrder(null); // Close the edit form
            console.log("Pedido editado con éxito!");
        } catch (e) {
            console.error("Error al guardar pedido editado: ", e);
        }
    };

    // Function to delete an order
    const deleteOrder = async (orderId, orderAmount) => {
        console.log("Attempting to delete order:", orderId, "Amount:", orderAmount);
        if (!db || !userId || !selectedClient || !orderId) {
            console.error("No se puede eliminar el pedido. ID o cliente no proporcionado.");
            return;
        }

        const confirmed = window.confirm('¿Estás seguro de que quieres eliminar este pedido? El saldo del cliente se ajustará.');
        console.log("Confirmation result for order deletion:", confirmed);

        if (!confirmed) {
            console.log("Order deletion cancelled by user.");
            return;
        }

        try {
            console.log("Proceeding with order deletion...");
            const orderRef = doc(db, `artifacts/${__app_id}/users/${userId}/clients/${selectedClient.id}/orders/${orderId}`);
            await deleteDoc(orderRef);
            console.log("Order document deleted from Firestore.");
            await updateClientBalance(selectedClient.id, orderAmount); // Add order amount back to balance
            console.log("Client balance updated after order deletion.");
            console.log("Pedido eliminado con éxito!");
        } catch (e) {
            console.error("Error al eliminar pedido: ", e.message, e); // Log full error object
        }
    };

    // Function to register a new payment
    const addPayment = async () => {
        let missingFields = [];
        if (!newPaymentAmount) missingFields.push("Monto del Pago");
        if (!newPaymentDate) missingFields.push("Fecha del Pago");

        if (missingFields.length > 0) {
            console.error(`Faltan los siguientes datos para registrar pago: ${missingFields.join(', ')}.`);
            return;
        }
        if (!db || !userId || !selectedClient) {
            console.error("No se puede registrar pago: Faltan datos de la aplicación o cliente seleccionado.");
            return;
        }

        const amount = parseFloat(newPaymentAmount);
        if (isNaN(amount) || amount <= 0) {
            console.error("Monto de pago inválido.");
            return;
        }

        try {
            const paymentsCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/clients/${selectedClient.id}/payments`);
            await addDoc(paymentsCollectionRef, {
                amount: amount,
                paymentDate: newPaymentDate,
                createdAt: new Date().toISOString()
            });
            await updateClientBalance(selectedClient.id, amount); // Increase balance by payment amount
            setNewPaymentAmount('');
            setNewPaymentDate(new Date().toISOString().split('T')[0]);
            console.log("Pago registrado con éxito!");
        } catch (e) {
            console.error("Error al registrar pago: ", e);
        }
    };

    // Function to start payment editing
    const handleEditPayment = (payment) => {
        setEditingPayment(payment);
        setEditPaymentAmount(payment.amount.toString());
        setEditPaymentDate(payment.paymentDate);
    };

    // Function to save edited payment changes
    const saveEditedPayment = async () => {
        if (!db || !userId || !editingPayment || !selectedClient || !editPaymentAmount || !editPaymentDate) {
            console.error("Faltan datos para guardar pago editado.");
            return;
        }
        const newAmount = parseFloat(editPaymentAmount);
        if (isNaN(newAmount) || newAmount <= 0) {
            console.error("Monto de pago inválido.");
            return;
        }

        try {
            const paymentRef = doc(db, `artifacts/${__app_id}/users/${userId}/clients/${selectedClient.id}/payments/${editingPayment.id}`);
            const oldAmount = editingPayment.amount;
            const amountChange = newAmount - oldAmount; // If new amount is greater, client owes less, balance increases. If less, owes more, balance decreases.

            await updateDoc(paymentRef, {
                amount: newAmount,
                paymentDate: editPaymentDate
            });
            await updateClientBalance(selectedClient.id, amountChange);
            setEditingPayment(null); // Close the edit form
            console.log("Pago editado con éxito!");
        } catch (e) {
            console.error("Error al guardar pago editado: ", e);
        }
    };

    // Function to delete a payment
    const deletePayment = async (paymentId, paymentAmount) => {
        console.log("Attempting to delete payment:", paymentId, "Amount:", paymentAmount);
        if (!db || !userId || !selectedClient || !paymentId) {
            console.error("No se puede eliminar el pago. ID o cliente no proporcionado.");
            return;
        }

        const confirmed = window.confirm('¿Estás seguro de que quieres eliminar este pago? El saldo del cliente se ajustará.');
        console.log("Confirmation result for payment deletion:", confirmed);

        if (!confirmed) {
            console.log("Payment deletion cancelled by user.");
            return;
        }

        try {
            console.log("Proceeding with payment deletion...");
            const paymentRef = doc(db, `artifacts/${__app_id}/users/${userId}/clients/${selectedClient.id}/payments/${paymentId}`);
            await deleteDoc(paymentRef);
            console.log("Payment document deleted from Firestore.");
            await updateClientBalance(selectedClient.id, -paymentAmount); // Subtract payment amount from balance
            console.log("Client balance updated after payment deletion.");
            console.log("Pago eliminado con éxito!");
        } catch (e) {
            console.error("Error al eliminar pago: ", e.message, e); // Log full error object
        }
    };

    // Combined and sorted history of orders and payments
    const combinedHistory = [...orders.map(o => ({ ...o, type: 'order', date: o.orderDate, displayAmount: -o.amount })),
                             ...payments.map(p => ({ ...p, type: 'payment', date: p.paymentDate, displayAmount: p.amount }))]
        .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, most recent first

    return (
        <div className="bg-white p-10 rounded-xl shadow-2xl max-w-6xl w-full flex flex-col lg:flex-row gap-8">
            {/* View Selector */}
            <div className="w-full mb-6 flex justify-center gap-4">
                <button
                    onClick={() => setCurrentView('clients')}
                    className={`px-6 py-3 rounded-full font-bold text-lg transition-all duration-300 ${
                        currentView === 'clients' ? 'bg-pink-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Gestión de Clientes
                </button>
                <button
                    onClick={() => setCurrentView('reports')}
                    className={`px-6 py-3 rounded-full font-bold text-lg transition-all duration-300 ${
                        currentView === 'reports' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Reportes y Estadísticas
                </button>
            </div>

            {currentView === 'clients' ? (
                <>
                    {/* Client Management Column */}
                    <div className="lg:w-1/3 w-full bg-pink-50 p-6 rounded-lg shadow-inner flex flex-col">
                        <h2 className="text-4xl font-extrabold text-pink-800 mb-6 text-center">
                            Clientes
                        </h2>

                        {/* Form to add new client */}
                        <div className="mb-6 pb-4 border-b border-pink-200">
                            <h3 className="text-2xl font-bold text-pink-700 mb-3">Añadir Cliente</h3>
                            <div className="flex flex-col gap-3">
                                <input
                                    type="text"
                                    placeholder="Nombre del Cliente (Obligatorio)"
                                    value={newClientName}
                                    onChange={(e) => setNewClientName(e.target.value)}
                                    className="p-3 border border-pink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-gray-800"
                                />
                                <input
                                    type="text"
                                    placeholder="Número de Celular (Opcional)"
                                    value={newClientCelular}
                                    onChange={(e) => setNewClientCelular(e.target.value)}
                                    className="p-3 border border-pink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-gray-800"
                                />
                                {/* City Selector */}
                                <select
                                    value={selectedCity}
                                    onChange={(e) => {
                                        if (e.target.value === 'addNewCity') {
                                            setShowNewCityInput(true);
                                            setSelectedCity(''); // Clear selection if adding new
                                        } else {
                                            setShowNewCityInput(false);
                                            setSelectedCity(e.target.value);
                                        }
                                    }}
                                    className="p-3 border border-pink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-gray-800"
                                >
                                    <option value="">Selecciona una Ciudad (Opcional)</option>
                                    {cities.map((city, index) => (
                                        <option key={index} value={city}>{city}</option>
                                    ))}
                                    <option value="addNewCity">Agregar nueva ciudad...</option>
                                </select>

                                {/* Input for new city (conditional) */}
                                {showNewCityInput && (
                                    <input
                                        type="text"
                                        placeholder="Nombre de la Nueva Ciudad"
                                        value={newClientCityInput}
                                        onChange={(e) => setNewClientCityInput(e.target.value)}
                                        className="p-3 border border-pink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-gray-800"
                                    />
                                )}

                                <button
                                    onClick={addClient}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105"
                                >
                                    Añadir Cliente
                                </button>
                            </div>
                        </div>

                        {/* Client Filters */}
                        <div className="mb-6 p-4 bg-pink-100 rounded-lg shadow-sm">
                            <h3 className="text-2xl font-bold text-pink-700 mb-3">Filtrar Clientes</h3>
                            <div className="flex flex-col gap-3">
                                <input
                                    type="text"
                                    placeholder="Buscar por Nombre..."
                                    value={searchName}
                                    onChange={(e) => setSearchName(e.target.value)}
                                    className="p-3 border border-pink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-gray-800"
                                />
                                <select
                                    value={filterCity}
                                    onChange={(e) => setFilterCity(e.target.value)}
                                    className="p-3 border border-pink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-gray-800"
                                >
                                    <option value="">Todas las Ciudades</option>
                                    {cities.map((city, index) => (
                                        <option key={index} value={city}>{city}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Client List */}
                        <h3 className="text-2xl font-bold text-pink-700 mb-4 text-center">Tus Clientes</h3>
                        {loadingClients ? (
                            <p className="text-center text-gray-600">Cargando clientes...</p>
                        ) : clients.length === 0 ? (
                            <p className="text-center text-gray-600">No hay clientes registrados aún.</p>
                        ) : (
                            <div className="flex-grow overflow-y-auto max-h-96">
                                {clients.map((client) => (
                                    <div
                                        key={client.id}
                                        onClick={() => setSelectedClient(client)} // Only selects the client
                                        className={`flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 mb-2 rounded-lg shadow-md cursor-pointer transition-all duration-200
                                            ${selectedClient && selectedClient.id === client.id ? 'bg-pink-200 border-2 border-pink-600' : 'bg-white hover:bg-pink-100'}`}
                                    >
                                        <div className="flex-grow">
                                            <span className="font-medium text-gray-800 text-lg block">{client.name}</span>
                                            <span className="text-gray-600 text-sm italic block">{client.city}</span>
                                            {client.celular && <span className="text-gray-600 text-sm block">Cel: {client.celular}</span>}
                                        </div>
                                        <div className="flex items-center mt-2 sm:mt-0 space-x-2">
                                            <span className={`font-bold text-lg ${client.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                ${client.balance.toFixed(2)}
                                            </span>
                                            {/* Removed the "Editar" button from here as requested */}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Selected Client Details Column (Orders and Payments) */}
                    <div className="lg:w-2/3 w-full bg-purple-50 p-6 rounded-lg shadow-inner relative"> {/* Added relative for dropdown positioning */}
                        {selectedClient ? (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-4xl font-extrabold text-purple-800 text-center flex-grow">
                                        Detalles de {selectedClient.name}
                                    </h2>
                                    {/* Dropdown for client actions */}
                                    <div className="relative" ref={dropdownRef}>
                                        <button
                                            onClick={() => setShowClientActionsDropdown(!showClientActionsDropdown)}
                                            className="text-purple-800 hover:text-purple-900 text-4xl font-bold p-2 rounded-full hover:bg-purple-100 transition-colors duration-200"
                                            aria-label="Opciones del cliente"
                                        >
                                            •••
                                        </button>
                                        {showClientActionsDropdown && (
                                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                                                <button
                                                    onClick={() => deleteClient(selectedClient.id)}
                                                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                                >
                                                    Eliminar Cliente
                                                </button>
                                                {/* Moved the "Editar Cliente" button here, below "Eliminar Cliente" */}
                                                <button
                                                    onClick={() => handleEditClient(selectedClient)}
                                                    className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                                                >
                                                    Editar Cliente
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <p className="text-center text-xl text-gray-700 mb-6">
                                    Saldo Actual: <span className={`font-bold ${selectedClient.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        ${selectedClient.balance.toFixed(2)}
                                    </span>
                                </p>
                                <button
                                    onClick={() => setSelectedClient(null)}
                                    className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-full shadow-md transform transition-all duration-300 hover:scale-105 mb-8 mx-auto block"
                                >
                                    Cambiar Cliente
                                </button>


                                {/* Add New Order Section */}
                                <div className="mb-10">
                                    <h3 className="text-3xl font-bold text-purple-700 mb-4 text-center">Añadir Nuevo Pedido</h3>
                                    <div className="mb-6 p-4 bg-purple-100 rounded-lg shadow-sm">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <input
                                                type="text"
                                                placeholder="Descripción del Pedido"
                                                value={newOrderDescription}
                                                onChange={(e) => setNewOrderDescription(e.target.value)}
                                                className="p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 col-span-2"
                                            />
                                            <input
                                                type="number"
                                                placeholder="Monto"
                                                value={newOrderAmount}
                                                onChange={(e) => setNewOrderAmount(e.target.value)}
                                                className="p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                                            />
                                            <input
                                                type="date"
                                                value={newOrderDate}
                                                onChange={(e) => setNewOrderDate(e.target.value)}
                                                className="p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                                            />
                                            <button
                                                onClick={addOrder}
                                                className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 col-span-full"
                                            >
                                                Añadir Pedido
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Add New Payment Section */}
                                <div className="mb-10">
                                    <h3 className="text-3xl font-bold text-purple-700 mb-4 text-center">Registrar Nuevo Pago</h3>
                                    <div className="mb-6 p-4 bg-purple-100 rounded-lg shadow-sm">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <input
                                                type="number"
                                                placeholder="Monto del Pago"
                                                value={newPaymentAmount}
                                                onChange={(e) => setNewPaymentAmount(e.target.value)}
                                                className="p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                                            />
                                            <input
                                                type="date"
                                                value={newPaymentDate}
                                                onChange={(e) => setNewPaymentDate(e.target.value)}
                                                className="p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                                            />
                                            <button
                                                onClick={addPayment}
                                                className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 col-span-full"
                                            >
                                                Registrar Pago
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Unified History Section */}
                                <div>
                                    <h3 className="text-3xl font-bold text-purple-700 mb-4 text-center">Historial de Movimientos</h3>
                                    {combinedHistory.length === 0 ? (
                                        <p className="text-center text-gray-600">No hay movimientos registrados para este cliente.</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full bg-white rounded-lg shadow-md">
                                                <thead className="bg-purple-100">
                                                    <tr>
                                                        <th className="py-3 px-4 text-left text-sm font-semibold text-purple-700 uppercase tracking-wider rounded-tl-lg">Fecha</th>
                                                        <th className="py-3 px-4 text-left text-sm font-semibold text-purple-700 uppercase tracking-wider">Tipo</th>
                                                        <th className="py-3 px-4 text-left text-sm font-semibold text-purple-700 uppercase tracking-wider">Descripción / Monto</th>
                                                        <th className="py-3 px-4 text-left text-sm font-semibold text-purple-700 uppercase tracking-wider rounded-tr-lg">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {combinedHistory.map((item) => (
                                                        <tr key={item.id} className="border-b border-purple-100 last:border-b-0 hover:bg-purple-50 transition-colors duration-200">
                                                            <td className="py-3 px-4 text-gray-600 text-sm">{new Date(item.date).toLocaleDateString('es-UY')}</td>
                                                            <td className="py-3 px-4 text-gray-800">
                                                                <span className={`font-semibold ${item.type === 'order' ? 'text-red-600' : 'text-green-600'}`}>
                                                                    {item.type === 'order' ? 'Pedido' : 'Pago'}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4 text-gray-800">
                                                                {item.type === 'order' ? item.description : 'Pago recibido'}
                                                                <br />
                                                                <span className={`font-bold ${item.displayAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                                    ${item.displayAmount.toFixed(2)}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4 flex space-x-2">
                                                                {item.type === 'order' ? (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleEditOrder(item)}
                                                                            className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1 px-2 rounded-full shadow-md transform transition-all duration-300 hover:scale-105"
                                                                        >
                                                                            Editar
                                                                        </button>
                                                                        <button
                                                                            onClick={() => deleteOrder(item.id, item.amount)}
                                                                            className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded-full shadow-md transform transition-all duration-300 hover:scale-105"
                                                                        >
                                                                            Eliminar
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleEditPayment(item)}
                                                                            className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1 px-2 rounded-full shadow-md transform transition-all duration-300 hover:scale-105"
                                                                        >
                                                                            Editar
                                                                        </button>
                                                                        <button
                                                                            onClick={() => deletePayment(item.id, item.amount)}
                                                                            className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded-full shadow-md transform transition-all duration-300 hover:scale-105"
                                                                        >
                                                                            Eliminar
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="text-center p-10 bg-purple-100 rounded-lg shadow-md">
                                <h3 className="text-3xl font-bold text-purple-700 mb-4">
                                    Selecciona un Cliente
                                </h3>
                                <p className="text-lg text-gray-700">
                                    Haz clic en un cliente de la lista de la izquierda para ver sus pedidos y pagos, o para añadir nuevos.
                                </p>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <ReportsSection db={db} userId={userId} allClients={clients} />
            )}


            {/* Client Edit Modal */}
            {editingClient && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full">
                        <h3 className="text-3xl font-bold text-pink-800 mb-6 text-center">
                            Editar Cliente: {editingClient.name}
                        </h3>
                        <div className="flex flex-col gap-4">
                            <input
                                type="text"
                                placeholder="Nombre del Cliente"
                                value={editClientName}
                                onChange={(e) => setEditClientName(e.target.value)}
                                className="p-3 border border-pink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-gray-800"
                            />
                            <input
                                type="text"
                                placeholder="Número de Celular"
                                value={editClientCelular}
                                onChange={(e) => setEditClientCelular(e.target.value)}
                                className="p-3 border border-pink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-gray-800"
                            />
                            <select
                                value={editClientCity}
                                onChange={(e) => {
                                    if (e.target.value === 'addNewCity') {
                                        setShowEditNewCityInput(true);
                                        setEditClientCity('');
                                    } else {
                                        setShowEditNewCityInput(false);
                                        setEditClientCity(e.target.value);
                                    }
                                }}
                                className="p-3 border border-pink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-gray-800"
                            >
                                <option value="">Selecciona una Ciudad</option>
                                {cities.map((city, index) => (
                                    <option key={index} value={city}>{city}</option>
                                ))}
                                <option value="addNewCity">Agregar nueva ciudad...</option>
                            </select>

                            {showEditNewCityInput && (
                                <input
                                    type="text"
                                    placeholder="Nombre de la Nueva Ciudad"
                                    value={newClientCityInput}
                                    onChange={(e) => setNewClientCityInput(e.target.value)}
                                    className="p-3 border border-pink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-gray-800"
                                />
                            )}

                            <div className="flex justify-end gap-4 mt-4">
                                <button
                                    onClick={() => setEditingClient(null)}
                                    className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-full shadow-md transform transition-all duration-300 hover:scale-105"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={saveEditedClient}
                                    className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-full shadow-md transform transition-all duration-300 hover:scale-105"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Edit Modal */}
            {editingOrder && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full">
                        <h3 className="text-3xl font-bold text-purple-800 mb-6 text-center">
                            Editar Pedido
                        </h3>
                        <div className="flex flex-col gap-4">
                            <input
                                type="text"
                                placeholder="Descripción del Pedido"
                                value={editOrderDescription}
                                onChange={(e) => setEditOrderDescription(e.target.value)}
                                className="p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                            />
                            <input
                                type="number"
                                placeholder="Monto"
                                value={editOrderAmount}
                                onChange={(e) => setEditOrderAmount(e.target.value)}
                                className="p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                            />
                            <input
                                type="date"
                                value={editOrderDate}
                                onChange={(e) => setEditOrderDate(e.target.value)}
                                className="p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                            />
                            <div className="flex justify-end gap-4 mt-4">
                                <button
                                    onClick={() => setEditingOrder(null)}
                                    className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-full shadow-md transform transition-all duration-300 hover:scale-105"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={saveEditedOrder}
                                    className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Edit Modal */}
            {editingPayment && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full">
                        <h3 className="text-3xl font-bold text-purple-800 mb-6 text-center">
                            Editar Pago
                        </h3>
                        <div className="flex flex-col gap-4">
                            <input
                                type="number"
                                placeholder="Monto del Pago"
                                value={editPaymentAmount}
                                onChange={(e) => setEditPaymentAmount(e.target.value)}
                                className="p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                            />
                            <input
                                type="date"
                                value={editPaymentDate}
                                onChange={(e) => setEditPaymentDate(e.target.value)}
                                className="p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                            />
                            <div className="flex justify-end gap-4 mt-4">
                                <button
                                    onClick={() => setEditingPayment(null)}
                                    className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-full shadow-md transform transition-all duration-300 hover:scale-105"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={saveEditedPayment}
                                    className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// New ReportsSection Component
const ReportsSection = ({ db, userId, allClients }) => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const [reportStartDate, setReportStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
    const [reportEndDate, setReportEndDate] = useState(today.toISOString().split('T')[0]);
    const [selectedReportClient, setSelectedReportClient] = useState(''); // Client ID for filtering reports

    const [allOrders, setAllOrders] = useState([]);
    const [allPayments, setAllPayments] = useState([]);
    const [loadingReports, setLoadingReports] = useState(true);

    const [filteredOrders, setFilteredOrders] = useState([]);
    const [filteredPayments, setFilteredPayments] = useState([]);

    const [salesVsPaymentsData, setSalesVsPaymentsData] = useState([]); // Data for sales vs payments pie chart
    const [clientActivityData, setClientActivityData] = useState([]); // Data for top clients pie chart

    // Color palette for charts
    const COLORS = ['#EC4899', '#9333EA', '#FACC15', '#3B82F6', '#10B981', '#EF4444', '#6366F1', '#F97316', '#A855F7', '#F472B6'];


    // Function to fetch all orders and payments for all clients
    const fetchReportData = async () => {
        if (!db || !userId) return;
        setLoadingReports(true);
        const fetchedOrders = [];
        const fetchedPayments = [];

        try {
            const clientsCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/clients`);
            const clientsSnapshot = await getDocs(clientsCollectionRef);

            for (const clientDoc of clientsSnapshot.docs) {
                const clientId = clientDoc.id;
                const clientData = clientDoc.data();

                // Fetch orders for this client
                const ordersRef = collection(db, `artifacts/${__app_id}/users/${userId}/clients/${clientId}/orders`);
                const ordersSnapshot = await getDocs(ordersRef);
                ordersSnapshot.forEach(orderDoc => {
                    fetchedOrders.push({ clientId, clientName: clientData.name, id: orderDoc.id, ...orderDoc.data() });
                });

                // Fetch payments for this client
                const paymentsRef = collection(db, `artifacts/${__app_id}/users/${userId}/clients/${clientId}/payments`);
                const paymentsSnapshot = await getDocs(paymentsRef);
                paymentsSnapshot.forEach(paymentDoc => {
                    fetchedPayments.push({ clientId, clientName: clientData.name, id: paymentDoc.id, ...paymentDoc.data() });
                });
            }
            setAllOrders(fetchedOrders);
            setAllPayments(fetchedPayments);
        } catch (error) {
            console.error("Error al obtener datos para reportes:", error);
        } finally {
            setLoadingReports(false);
        }
    };

    // Effect to fetch initial report data
    useEffect(() => {
        fetchReportData();
    }, [db, userId]); // Re-fetch when db or user changes

    // Effect to filter and process data for charts when filters or raw data change
    useEffect(() => {
        if (!allOrders || !allPayments) return;

        let tempFilteredOrders = allOrders;
        let tempFilteredPayments = allPayments;

        // Filter by date range
        const start = reportStartDate ? new Date(reportStartDate) : null;
        const end = reportEndDate ? new Date(reportEndDate) : null;

        if (start) {
            tempFilteredOrders = tempFilteredOrders.filter(order => new Date(order.orderDate) >= start);
            tempFilteredPayments = tempFilteredPayments.filter(payment => new Date(payment.paymentDate) >= start);
        }
        if (end) {
            // To include the end day, set the time to end of day
            const endDateInclusive = new Date(end);
            endDateInclusive.setHours(23, 59, 59, 999);
            tempFilteredOrders = tempFilteredOrders.filter(order => new Date(order.orderDate) <= endDateInclusive);
            tempFilteredPayments = tempFilteredPayments.filter(payment => new Date(payment.paymentDate) <= endDateInclusive);
        }

        // Filter by selected client
        if (selectedReportClient) {
            tempFilteredOrders = tempFilteredOrders.filter(order => order.clientId === selectedReportClient);
            tempFilteredPayments = tempFilteredPayments.filter(payment => payment.clientId === selectedReportClient);
        }

        setFilteredOrders(tempFilteredOrders);
        setFilteredPayments(tempFilteredPayments);

        // Process for sales vs payments pie chart
        const totalSales = tempFilteredOrders.reduce((sum, order) => sum + order.amount, 0);
        const totalPayments = tempFilteredPayments.reduce((sum, payment) => sum + payment.amount, 0);

        const salesPaymentsPieData = [];
        if (totalSales > 0) salesPaymentsPieData.push({ name: 'Ventas Totales', value: parseFloat(totalSales.toFixed(2)) });
        if (totalPayments > 0) salesPaymentsPieData.push({ name: 'Pagos Totales', value: parseFloat(totalPayments.toFixed(2)) });
        setSalesVsPaymentsData(salesPaymentsPieData);


        // Process for top clients chart (based on current balance)
        const clientBalancesForReport = allClients
            .filter(client => {
                // Only include clients that have orders or payments within the filtered range, or if no client filter is applied
                const hasOrdersInFilteredRange = tempFilteredOrders.some(order => order.clientId === client.id);
                const hasPaymentsInFilteredRange = tempFilteredPayments.some(payment => payment.clientId === client.id);
                return (selectedReportClient === '' || selectedReportClient === client.id) && (hasOrdersInFilteredRange || hasPaymentsInFilteredRange || client.balance !== 0);
            })
            .map(client => ({
                name: client.name,
                value: parseFloat(client.balance.toFixed(2)), // Use 'value' for PieChart
            }))
            .filter(client => client.value !== 0); // Only show clients with non-zero balance in pie chart

        setClientActivityData(clientBalancesForReport);

    }, [allOrders, allPayments, reportStartDate, reportEndDate, selectedReportClient, allClients]);

    // Calculate total sales and payments for summary
    const totalSales = filteredOrders.reduce((sum, order) => sum + order.amount, 0);
    const totalPayments = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);

    return (
        <div className="w-full bg-white p-8 rounded-xl shadow-2xl flex flex-col gap-8">
            <h2 className="text-4xl font-extrabold text-purple-800 mb-6 text-center">
                Reportes y Estadísticas
            </h2>

            {/* Filters Section */}
            <div className="bg-purple-100 p-6 rounded-lg shadow-inner flex flex-col md:flex-row gap-4 items-center justify-center mb-6">
                <div className="flex flex-col gap-2 w-full md:w-auto">
                    <label htmlFor="startDate" className="text-purple-700 font-semibold">Fecha Inicio:</label>
                    <input
                        type="date"
                        id="startDate"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className="p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                    />
                </div>
                <div className="flex flex-col gap-2 w-full md:w-auto">
                    <label htmlFor="endDate" className="text-purple-700 font-semibold">Fecha Fin:</label>
                    <input
                        type="date"
                        id="endDate"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className="p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                    />
                </div>
                <div className="flex flex-col gap-2 w-full md:w-auto">
                    <label htmlFor="clientFilter" className="text-purple-700 font-semibold">Filtrar por Cliente:</label>
                    <select
                        id="clientFilter"
                        value={selectedReportClient}
                        onChange={(e) => setSelectedReportClient(e.target.value)}
                        className="p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                    >
                        <option value="">Todos los Clientes</option>
                        {allClients.map(client => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loadingReports ? (
                <p className="text-center text-gray-600 text-xl">Cargando datos de reportes...</p>
            ) : (
                <>
                    {/* Summary Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="bg-pink-200 p-6 rounded-lg shadow-md text-center">
                            <h3 className="text-2xl font-bold text-pink-800 mb-2">Total Ventas</h3>
                            <p className="text-4xl font-extrabold text-pink-900">${totalSales.toFixed(2)}</p>
                        </div>
                        <div className="bg-purple-200 p-6 rounded-lg shadow-md text-center">
                            <h3 className="text-2xl font-bold text-purple-800 mb-2">Total Pagos</h3>
                            <p className="text-4xl font-extrabold text-purple-900">${totalPayments.toFixed(2)}</p>
                        </div>
                    </div>

                    {/* Sales and Payments Pie Chart */}
                    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                        <h3 className="text-2xl font-bold text-purple-700 mb-4 text-center">Ventas vs. Pagos (Proporción Total)</h3>
                        {salesVsPaymentsData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={salesVsPaymentsData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                        nameKey="name" // Use nameKey for the legend
                                    >
                                        {salesVsPaymentsData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-center text-gray-600">No hay datos de ventas o pagos en el rango de fechas seleccionado para mostrar proporciones.</p>
                        )}
                    </div>

                    {/* Clients with Outstanding Balance Pie Chart */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-2xl font-bold text-purple-700 mb-4 text-center">Clientes por Saldo Actual (Proporción)</h3>
                        {clientActivityData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={clientActivityData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                        nameKey="name" // Use nameKey for the legend
                                    >
                                        {clientActivityData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-center text-gray-600">No hay clientes con saldos para mostrar en el rango seleccionado.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// Export the main component for rendering
export default App;
