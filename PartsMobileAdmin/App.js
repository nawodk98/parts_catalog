import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  FlatList, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, 
  Platform, Keyboard, Alert, ScrollView
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const CONFIG_PATH = FileSystem.documentDirectory + 'admin_config.json';

export default function App() {
  const [serverUrl, setServerUrl] = useState('http://192.168.1.XXX:3000');
  const [authToken, setAuthToken] = useState(null);
  const [adminUser, setAdminUser] = useState('');
  
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [appReady, setAppReady] = useState(false);

  // Dashboard state
  const [activeTab, setActiveTab] = useState('part'); // 'part' | 'manage' | 'users'
  const [loading, setLoading] = useState(false);

  // Forms - Part Form State
  const [editingPartId, setEditingPartId] = useState(null);
  const [partType, setPartType] = useState('Genuine'); // 'Genuine' | 'OEM'
  const [partNumber, setPartNumber] = useState('');
  const [partName, setPartName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [engineType, setEngineType] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  
  // OEM-specific state
  const [oemBrand, setOemBrand] = useState('');
  const [compatibleGenuine, setCompatibleGenuine] = useState('');

  // Specifications state
  const [specifications, setSpecifications] = useState({});
  const [specKey, setSpecKey] = useState('');
  const [specVal, setSpecVal] = useState('');

  // Manage Parts State
  const [manageSearchQuery, setManageSearchQuery] = useState('');
  const [partsList, setPartsList] = useState([]);
  const [partsLoading, setPartsLoading] = useState(false);

  // User Management State
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserLoading, setNewUserLoading] = useState(false);

  // Scroll ref for forms
  const formScrollRef = useRef(null);

  // Load config on mount
  useEffect(() => {
    loadAppConfig();
  }, []);

  const loadAppConfig = async () => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(CONFIG_PATH);
      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(CONFIG_PATH);
        const parsed = JSON.parse(content);
        if (parsed.serverUrl) setServerUrl(parsed.serverUrl);
        if (parsed.authToken) {
          setAuthToken(parsed.authToken);
          setAdminUser(parsed.username || 'admin');
        }
      }
    } catch (e) {
      console.log("Failed to load local config:", e);
    }
    setAppReady(true);
  };

  const saveAppConfig = async (url, token, username = 'admin') => {
    try {
      await FileSystem.writeAsStringAsync(CONFIG_PATH, JSON.stringify({
        serverUrl: url,
        authToken: token,
        username: username
      }));
    } catch (e) {
      console.log("Failed to save config:", e);
    }
  };

  // API Request Wrapper
  const apiCall = async (endpoint, options = {}) => {
    const url = `${serverUrl}${endpoint}`;
    
    if (!options.headers) options.headers = {};
    options.headers['Content-Type'] = 'application/json';
    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
      const res = await fetch(url, options);
      if (res.status === 401 && endpoint !== '/api/login') {
        // Unauthorized
        handleLogout();
        Alert.alert("Session Expired", "Please login again.");
        throw new Error("Unauthorized");
      }
      return res;
    } catch (e) {
      if (e.message !== "Unauthorized") {
        throw e;
      }
      throw new Error("Session Expired");
    }
  };

  const handleLogin = async () => {
    if (!serverUrl.trim()) {
      Alert.alert("Error", "Please enter a valid Server URL.");
      return;
    }
    if (!loginUsername.trim() || !loginPassword.trim()) {
      Alert.alert("Error", "Please enter username and password.");
      return;
    }

    Keyboard.dismiss();
    setLoginLoading(true);

    // Format serverUrl: remove trailing slash
    let formattedUrl = serverUrl.trim();
    if (formattedUrl.endsWith('/')) {
      formattedUrl = formattedUrl.slice(0, -1);
    }
    setServerUrl(formattedUrl);

    try {
      const res = await fetch(`${formattedUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });

      if (res.ok) {
        const data = await res.json();
        setAuthToken(data.token);
        setAdminUser(data.username || loginUsername);
        await saveAppConfig(formattedUrl, data.token, data.username || loginUsername);
        setLoginPassword('');
        setLoginUsername('');
        // Trigger fetching lists on success
        setTimeout(() => {
          setActiveTab('part');
        }, 100);
      } else {
        const errData = await res.json().catch(() => ({}));
        Alert.alert("Login Failed", errData.error || "Invalid username or password.");
      }
    } catch (e) {
      Alert.alert("Connection Failed", "Could not connect to the server. Check your Server URL!");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Best effort logout on server
      await apiCall('/api/logout', { method: 'POST' }).catch(() => {});
    } catch(e) {}
    setAuthToken(null);
    setAdminUser('');
    await saveAppConfig(serverUrl, null, '');
  };

  // --- Specifications Logic ---
  const addSpecification = () => {
    const key = specKey.trim();
    const val = specVal.trim();
    if (key && val) {
      setSpecifications(prev => ({ ...prev, [key]: val }));
      setSpecKey('');
      setSpecVal('');
    } else {
      Alert.alert("Input Needed", "Please enter both key and value (e.g. Thread -> M10).");
    }
  };

  const removeSpecification = (key) => {
    setSpecifications(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  // --- Save / Update Part ---
  const handleSavePart = async () => {
    if (!partNumber.trim() || !partName.trim() || !category.trim()) {
      Alert.alert("Required Fields", "Part Number, Part Name, and Category are required!");
      return;
    }

    setLoading(true);
    const bodyData = {
      part_type: partType,
      brand: partType === 'OEM' ? oemBrand : null,
      part_number: partNumber.trim(),
      name: partName.trim(),
      description: description.trim(),
      category: category.trim(),
      engine_type: engineType.trim() || null,
      specifications: specifications,
      vehicle_brand: vehicleBrand.trim() || null,
      vehicle_model: vehicleModel.trim() || null,
      compatible_genuine_numbers: partType === 'OEM' ? compatibleGenuine : null
    };

    try {
      const isUpdating = editingPartId !== null;
      const endpoint = isUpdating ? `/api/parts/${editingPartId}` : '/api/parts';
      const method = isUpdating ? 'PUT' : 'POST';

      const res = await apiCall(endpoint, {
        method: method,
        body: JSON.stringify(bodyData)
      });

      if (res.ok) {
        Alert.alert(
          "Success", 
          isUpdating ? "Part updated successfully!" : "Part added successfully!"
        );
        
        if (isUpdating) {
          cancelEditPart();
          setActiveTab('manage');
          fetchPartsList();
        } else {
          // Clear only specific fields (mirroring web behaviour to support fast data entry)
          setPartNumber('');
          setCompatibleGenuine('');
          setSpecifications({});
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        Alert.alert("Error Saving", errData.error || "Failed to save part.");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  const editPart = async (part) => {
    setLoading(true);
    try {
      const res = await apiCall(`/api/parts/${part.id}`);
      if (res.ok) {
        const data = await res.json();
        setEditingPartId(data.id);
        setPartType(data.part_type || 'Genuine');
        setPartNumber(data.part_number || '');
        setPartName(data.name || '');
        setDescription(data.description || '');
        setCategory(data.category || '');
        setEngineType(data.engine_type || '');
        setVehicleBrand(data.vehicle_brand || '');
        setVehicleModel(data.vehicle_model || '');
        setOemBrand(data.brand || '');
        setCompatibleGenuine(data.compatible_genuine_numbers || '');
        
        let parsedSpecs = {};
        if (data.specifications) {
          try {
            parsedSpecs = JSON.parse(data.specifications);
          } catch(e) {
            parsedSpecs = {};
          }
        }
        setSpecifications(parsedSpecs);

        setActiveTab('part');
        if (formScrollRef.current) {
          formScrollRef.current.scrollTo({ y: 0, animated: true });
        }
      } else {
        Alert.alert("Error", "Could not fetch part details.");
      }
    } catch (e) {
      Alert.alert("Error", "Connection error while fetching part.");
    } finally {
      setLoading(false);
    }
  };

  const deletePart = (id, num) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to permanently delete part ${num}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const res = await apiCall(`/api/parts/${id}`, { method: 'DELETE' });
              if (res.ok) {
                Alert.alert("Deleted", "Part successfully deleted.");
                fetchPartsList();
              } else {
                Alert.alert("Error", "Failed to delete part.");
              }
            } catch (e) {
              Alert.alert("Error", "Connection failure.");
            }
          }
        }
      ]
    );
  };

  const cancelEditPart = () => {
    setEditingPartId(null);
    setPartType('Genuine');
    setPartNumber('');
    setPartName('');
    setDescription('');
    setCategory('');
    setEngineType('');
    setVehicleBrand('');
    setVehicleModel('');
    setOemBrand('');
    setCompatibleGenuine('');
    setSpecifications({});
  };

  // --- Manage Parts Logic ---
  const fetchPartsList = async (searchVal = manageSearchQuery) => {
    setPartsLoading(true);
    try {
      let endpoint = '/api/parts/all';
      if (searchVal.trim()) {
        endpoint = `/api/parts/search?q=${encodeURIComponent(searchVal.trim())}`;
      }
      
      const res = await apiCall(endpoint);
      if (res.ok) {
        const data = await res.json();
        setPartsList(data || []);
      }
    } catch (e) {
      console.log("Error loading parts:", e);
    } finally {
      setPartsLoading(false);
    }
  };

  useEffect(() => {
    if (authToken && activeTab === 'manage') {
      fetchPartsList();
    }
  }, [activeTab]);

  const handleSearchTextChange = (text) => {
    setManageSearchQuery(text);
    // Debounced or instant query trigger
    fetchPartsList(text);
  };

  // --- User Administration Logic ---
  const fetchUsersList = async () => {
    setUsersLoading(true);
    try {
      const res = await apiCall('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data || []);
      }
    } catch (e) {
      console.log("Error loading users:", e);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (authToken && activeTab === 'users') {
      fetchUsersList();
    }
  }, [activeTab]);

  const handleAddUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      Alert.alert("Error", "Username and password are required.");
      return;
    }
    setNewUserLoading(true);
    try {
      const res = await apiCall('/api/users', {
        method: 'POST',
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword.trim() })
      });
      if (res.ok) {
        Alert.alert("Success", `User '${newUsername}' registered.`);
        setNewUsername('');
        setNewPassword('');
        fetchUsersList();
      } else {
        const errData = await res.json().catch(() => ({}));
        Alert.alert("Error", errData.error || "Failed to create user.");
      }
    } catch (e) {
      Alert.alert("Error", "Connection error.");
    } finally {
      setNewUserLoading(false);
    }
  };

  const handleDeleteUser = (id, name) => {
    Alert.alert(
      "Delete User",
      `Delete user '${name}'?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await apiCall(`/api/users/${id}`, { method: 'DELETE' });
              if (res.ok) {
                Alert.alert("Deleted", "User deleted.");
                fetchUsersList();
              } else {
                const errData = await res.json().catch(() => ({}));
                Alert.alert("Error", errData.error || "Failed to delete user.");
              }
            } catch (e) {
              Alert.alert("Error", "Connection failure.");
            }
          }
        }
      ]
    );
  };

  // --- Views ---

  if (!appReady) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#e0aaff" />
      </View>
    );
  }

  // LOGIN SCREEN
  if (!authToken) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 25 }}>
            <View style={styles.loginCard}>
              <Text style={styles.loginTitle}>System <Text style={{ color: '#e0aaff' }}>Admin</Text></Text>
              <Text style={styles.loginSubtitle}>Manage Automotive Parts Catalog</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Server Connection URL</Text>
                <TextInput
                  style={styles.input}
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  placeholder="http://192.168.1.100:3000"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={loginUsername}
                  onChangeText={setLoginUsername}
                  placeholder="Enter admin username"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  placeholder="Enter password"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity 
                style={[styles.primaryButton, { marginTop: 15 }]} 
                onPress={handleLogin}
                disabled={loginLoading}
              >
                {loginLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.buttonText}>Secure Login</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // --- DASHBOARD AND NAVIGATION ---
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Sticky App Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <View>
              <Text style={styles.title}>System <Text style={{ color: '#e0aaff' }}>Admin</Text></Text>
              <Text style={styles.subtext}>Connected: {adminUser}</Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Selection Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'part' && styles.activeTab]} 
            onPress={() => setActiveTab('part')}
          >
            <Text style={[styles.tabText, activeTab === 'part' && styles.activeTabText]}>
              {editingPartId ? "Edit Part" : "Add Part"}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'manage' && styles.activeTab]} 
            onPress={() => setActiveTab('manage')}
          >
            <Text style={[styles.tabText, activeTab === 'manage' && styles.activeTabText]}>Manage</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'users' && styles.activeTab]} 
            onPress={() => setActiveTab('users')}
          >
            <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>Users</Text>
          </TouchableOpacity>
        </View>

        {/* MAIN VIEWS CONTAINER */}
        <View style={{ flex: 1 }}>
          
          {/* TAB 1: ADD PART FORM */}
          {activeTab === 'part' && (
            <ScrollView ref={formScrollRef} contentContainerStyle={styles.scrollForm}>
              <View style={styles.glassCard}>
                <Text style={styles.formHeaderTitle}>
                  {editingPartId ? "🔧 Edit Catalog Part" : "➕ Add New Part"}
                </Text>

                {/* Part Type Switcher */}
                <Text style={styles.inputLabel}>Part Type</Text>
                <View style={styles.typeSelectorContainer}>
                  <TouchableOpacity 
                    style={[styles.typeButton, partType === 'Genuine' && styles.typeButtonActive]}
                    onPress={() => setPartType('Genuine')}
                  >
                    <Text style={[styles.typeButtonText, partType === 'Genuine' && styles.typeButtonTextActive]}>
                      Genuine Part
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.typeButton, partType === 'OEM' && styles.typeButtonActive]}
                    onPress={() => setPartType('OEM')}
                  >
                    <Text style={[styles.typeButtonText, partType === 'OEM' && styles.typeButtonTextActive]}>
                      OEM / Alternative
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Part Number */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Part Number *</Text>
                  <TextInput
                    style={styles.input}
                    value={partNumber}
                    onChangeText={setPartNumber}
                    placeholder="e.g. TOY-12345"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoCapitalize="characters"
                  />
                </View>

                {/* OEM SPECIFIC FIELDS */}
                {partType === 'OEM' && (
                  <View style={{ marginBottom: 10 }}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>OEM Brand Name *</Text>
                      <TextInput
                        style={styles.input}
                        value={oemBrand}
                        onChangeText={setOemBrand}
                        placeholder="e.g. Bosch"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Compatible Genuine Part Numbers (comma-separated)</Text>
                      <TextInput
                        style={styles.input}
                        value={compatibleGenuine}
                        onChangeText={setCompatibleGenuine}
                        placeholder="e.g. TOY-12345, TOY-7890"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        autoCapitalize="characters"
                      />
                    </View>
                  </View>
                )}

                {/* Part Name */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Part Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={partName}
                    onChangeText={setPartName}
                    placeholder="e.g. C.V. Joint"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                </View>

                {/* Category */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Category / Type *</Text>
                  <TextInput
                    style={styles.input}
                    value={category}
                    onChangeText={setCategory}
                    placeholder="e.g. Brake System"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                </View>

                {/* Description */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Detailed Description</Text>
                  <TextInput
                    style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="e.g. Outer side, 30 teeth teeth count..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Fitment Parameters */}
                <View style={styles.divider} />
                <Text style={styles.sectionHeading}>Fitment Information (Optional)</Text>

                {/* Engine Type */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Assign to Engine</Text>
                  <TextInput
                    style={styles.input}
                    value={engineType}
                    onChangeText={setEngineType}
                    placeholder="e.g. 2KD"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoCapitalize="characters"
                  />
                </View>

                {/* Brand & Model Row */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Vehicle Brand</Text>
                    <TextInput
                      style={styles.input}
                      value={vehicleBrand}
                      onChangeText={setVehicleBrand}
                      placeholder="e.g. Toyota"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Vehicle Model</Text>
                    <TextInput
                      style={styles.input}
                      value={vehicleModel}
                      onChangeText={setVehicleModel}
                      placeholder="e.g. Corolla 121"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                  </View>
                </View>

                {/* SPECIFICATIONS BUILDER */}
                <View style={styles.divider} />
                <Text style={styles.sectionHeading}>⚙️ Dynamic Specifications (Optional)</Text>
                
                {/* Current Specifications pills list */}
                {Object.keys(specifications).length > 0 ? (
                  <View style={styles.specificationsList}>
                    {Object.entries(specifications).map(([key, val]) => (
                      <View key={key} style={styles.specPill}>
                        <Text style={styles.specPillText}>
                          <Text style={{ fontWeight: 'bold', color: '#e0aaff' }}>{key}:</Text> {val}
                        </Text>
                        <TouchableOpacity style={styles.specPillDelete} onPress={() => removeSpecification(key)}>
                          <Text style={styles.specPillDeleteText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noSpecsText}>No specifications added yet.</Text>
                )}

                {/* Spec Add Inputs */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={specKey}
                    onChangeText={setSpecKey}
                    placeholder="e.g. Diameter"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={specVal}
                    onChangeText={setSpecVal}
                    placeholder="e.g. 50mm"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                  <TouchableOpacity style={styles.specAddBtn} onPress={addSpecification}>
                    <Text style={styles.specAddBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {/* Form Buttons */}
                <View style={{ marginTop: 30, gap: 12 }}>
                  <TouchableOpacity 
                    style={styles.primaryButton} 
                    onPress={handleSavePart}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.buttonText}>
                        {editingPartId ? "Update Part Record" : "Save Part to Catalog"}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {editingPartId && (
                    <TouchableOpacity style={styles.cancelBtn} onPress={cancelEditPart}>
                      <Text style={styles.cancelBtnText}>Cancel Editing</Text>
                    </TouchableOpacity>
                  )}
                </View>

              </View>
            </ScrollView>
          )}

          {/* TAB 2: MANAGE PARTS VIEW */}
          {activeTab === 'manage' && (
            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10 }}>
              {/* Online search bar */}
              <View style={{ marginBottom: 15 }}>
                <TextInput
                  style={styles.input}
                  placeholder="Search catalog in real-time..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={manageSearchQuery}
                  onChangeText={handleSearchTextChange}
                />
              </View>

              {partsLoading ? (
                <View style={[styles.center, { flex: 1 }]}>
                  <ActivityIndicator size="large" color="#e0aaff" />
                </View>
              ) : (
                <FlatList
                  data={partsList}
                  keyExtractor={(item) => item.id.toString()}
                  contentContainerStyle={{ paddingBottom: 40 }}
                  ListEmptyComponent={
                    <Text style={styles.emptyListText}>No matching catalog parts found.</Text>
                  }
                  renderItem={({ item }) => {
                    const isOem = item.part_type === 'OEM';
                    
                    let parsedSpecs = {};
                    if (item.specifications) {
                      try {
                        parsedSpecs = JSON.parse(item.specifications);
                      } catch(e) {}
                    }

                    return (
                      <View style={styles.partItemCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                          <Text style={styles.partItemNum}>{item.part_number}</Text>
                          <View style={[styles.itemBadge, isOem ? styles.badgeOem : styles.badgeGenuine]}>
                            <Text style={[styles.badgeText, isOem ? styles.badgeTextOem : styles.badgeTextGenuine]}>
                              {isOem ? `OEM - ${item.brand || 'Alternative'}` : "Genuine"}
                            </Text>
                          </View>
                        </View>
                        
                        <Text style={styles.partItemName}>{item.name}</Text>
                        <Text style={styles.partItemCategory}>Category: {item.category}</Text>
                        
                        {item.description ? (
                          <Text style={styles.partItemDesc}>{item.description}</Text>
                        ) : null}

                        {/* Specs badges */}
                        {Object.keys(parsedSpecs).length > 0 && (
                          <View style={styles.itemSpecsRow}>
                            {Object.entries(parsedSpecs).map(([key, val]) => (
                              <View key={key} style={styles.itemSpecBadge}>
                                <Text style={styles.itemSpecBadgeText}>{key}: {val}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Fitments */}
                        {item.engine_type && (
                          <Text style={styles.fitmentItemText}>⚙️ Engine: {item.engine_type}</Text>
                        )}

                        {/* Actions */}
                        <View style={styles.cardActionsRow}>
                          <TouchableOpacity 
                            style={styles.cardActionEdit} 
                            onPress={() => editPart(item)}
                          >
                            <Text style={styles.cardActionEditText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.cardActionDelete} 
                            onPress={() => deletePart(item.id, item.part_number)}
                          >
                            <Text style={styles.cardActionDeleteText}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }}
                />
              )}
            </View>
          )}

          {/* TAB 3: USER ADMINISTRATION */}
          {activeTab === 'users' && (
            <ScrollView contentContainerStyle={styles.scrollForm}>
              {/* Add User */}
              <View style={styles.glassCard}>
                <Text style={styles.formHeaderTitle}>👤 Add User Account</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New Username</Text>
                  <TextInput
                    style={styles.input}
                    value={newUsername}
                    onChangeText={setNewUsername}
                    placeholder="Enter username"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter password"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity 
                  style={[styles.primaryButton, { marginTop: 10 }]} 
                  onPress={handleAddUser}
                  disabled={newUserLoading}
                >
                  {newUserLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.buttonText}>Register User Account</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* User Accounts List */}
              <View style={[styles.glassCard, { marginTop: 25 }]}>
                <Text style={styles.formHeaderTitle}>👥 Active Accounts</Text>
                
                {usersLoading ? (
                  <ActivityIndicator size="large" color="#e0aaff" style={{ marginVertical: 30 }} />
                ) : (
                  <View style={{ gap: 10 }}>
                    {usersList.length > 0 ? (
                      usersList.map((user) => (
                        <View key={user.id} style={styles.userCardItem}>
                          <Text style={styles.userCardUsername}>{user.username}</Text>
                          
                          {/* Cannot delete self */}
                          {user.username !== adminUser ? (
                            <TouchableOpacity 
                              style={styles.userCardDeleteBtn}
                              onPress={() => handleDeleteUser(user.id, user.username)}
                            >
                              <Text style={styles.userCardDeleteText}>Delete</Text>
                            </TouchableOpacity>
                          ) : (
                            <Text style={styles.userSelfLabel}>Active User</Text>
                          )}
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyListText}>No accounts found.</Text>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>
          )}

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  center: { justifyContent: 'center', alignItems: 'center' },
  
  // Header
  header: { 
    paddingHorizontal: 20, 
    paddingVertical: 15, 
    paddingTop: Platform.OS === 'android' ? 40 : 15, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255,255,255,0.06)' 
  },
  title: { color: 'white', fontSize: 22, fontWeight: '700' },
  subtext: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },
  logoutBtn: { 
    backgroundColor: 'rgba(255, 71, 87, 0.1)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.3)'
  },
  logoutBtnText: { color: '#ff4757', fontWeight: 'bold', fontSize: 13 },

  // Tabs navigation
  tabContainer: { 
    flexDirection: 'row', 
    marginHorizontal: 20, 
    marginVertical: 15, 
    backgroundColor: 'rgba(15,10,20,0.55)', 
    borderRadius: 10, 
    padding: 4, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.12)' 
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#7b2cbf' },
  tabText: { color: '#888', fontWeight: '600', fontSize: 13 },
  activeTabText: { color: 'white' },

  // Forms scrolling
  scrollForm: { paddingHorizontal: 20, paddingBottom: 40 },
  glassCard: { 
    backgroundColor: 'rgba(15,10,20,0.55)', 
    padding: 20, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.12)' 
  },
  formHeaderTitle: { color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 20 },

  // Inputs
  inputGroup: { marginBottom: 16 },
  inputLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: { 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    color: 'white', 
    borderRadius: 10, 
    paddingHorizontal: 15, 
    paddingVertical: 12, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.15)',
    fontSize: 14
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 20 },
  sectionHeading: { color: '#e0aaff', fontSize: 15, fontWeight: '700', marginBottom: 15 },

  // Login view card
  loginCard: { 
    backgroundColor: 'rgba(15,10,20,0.55)', 
    padding: 25, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#7b2cbf',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 }
  },
  loginTitle: { color: 'white', fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 5 },
  loginSubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', marginBottom: 25 },

  // Buttons
  primaryButton: { 
    backgroundColor: '#7b2cbf', 
    padding: 15, 
    borderRadius: 10, 
    alignItems: 'center', 
    shadowColor: '#9d4edd', 
    shadowOpacity: 0.4, 
    shadowRadius: 10, 
    shadowOffset: { width: 0, height: 4 } 
  },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  cancelBtn: { 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    padding: 14, 
    borderRadius: 10, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  cancelBtnText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 14 },

  // Part Type Switcher Group
  typeSelectorContainer: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeButton: { 
    flex: 1, 
    paddingVertical: 12, 
    borderRadius: 8, 
    backgroundColor: 'rgba(255,255,255,0.04)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)', 
    alignItems: 'center' 
  },
  typeButtonActive: { backgroundColor: '#7b2cbf', borderColor: '#9d4edd' },
  typeButtonText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 13 },
  typeButtonTextActive: { color: 'white' },

  // Specifications
  specificationsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 5 },
  specPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(157, 78, 221, 0.15)', 
    borderColor: 'rgba(157, 78, 221, 0.3)', 
    borderWidth: 1, 
    paddingLeft: 10, 
    paddingRight: 6, 
    paddingVertical: 4, 
    borderRadius: 20 
  },
  specPillText: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  specPillDelete: { 
    marginLeft: 6, 
    width: 18, 
    height: 18, 
    borderRadius: 9, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  specPillDeleteText: { color: 'white', fontSize: 12, fontWeight: 'bold', top: -1 },
  noSpecsText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontStyle: 'italic' },
  specAddBtn: { backgroundColor: '#7b2cbf', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 },
  specAddBtnText: { color: 'white', fontWeight: 'bold' },

  // Parts List Cards
  partItemCard: { 
    backgroundColor: 'rgba(15,10,20,0.55)', 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.12)' 
  },
  partItemNum: { color: '#e0aaff', fontSize: 15, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: 'bold' },
  partItemName: { color: 'white', fontSize: 17, fontWeight: '600', marginTop: 4 },
  partItemCategory: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  partItemDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 8, lineHeight: 18 },
  itemSpecsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  itemSpecBadge: { 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderColor: 'rgba(255,255,255,0.12)', 
    borderWidth: 1, 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 20 
  },
  itemSpecBadgeText: { fontSize: 11, color: '#a89bb8' },
  fitmentItemText: { color: '#4facfe', fontSize: 12, marginTop: 8, fontWeight: '500' },
  
  // Badges
  itemBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeOem: { backgroundColor: 'rgba(255, 165, 2, 0.15)' },
  badgeGenuine: { backgroundColor: 'rgba(46, 213, 115, 0.15)' },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  badgeTextOem: { color: '#ffa502' },
  badgeTextGenuine: { color: '#2ed573' },

  // Card Action buttons
  cardActionsRow: { flexDirection: 'row', gap: 10, marginTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 12 },
  cardActionEdit: { 
    flex: 1, 
    backgroundColor: 'rgba(123, 44, 191, 0.15)', 
    borderColor: 'rgba(123, 44, 191, 0.3)', 
    borderWidth: 1, 
    paddingVertical: 8, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  cardActionEditText: { color: '#e0aaff', fontWeight: '700', fontSize: 13 },
  cardActionDelete: { 
    flex: 1, 
    backgroundColor: 'rgba(255, 71, 87, 0.1)', 
    borderColor: 'rgba(255, 71, 87, 0.25)', 
    borderWidth: 1, 
    paddingVertical: 8, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  cardActionDeleteText: { color: '#ff4757', fontWeight: '700', fontSize: 13 },
  emptyListText: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40, fontSize: 14 },

  // Users Tab Cards
  userCardItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.03)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)', 
    paddingHorizontal: 15, 
    paddingVertical: 12, 
    borderRadius: 10 
  },
  userCardUsername: { color: 'white', fontSize: 15, fontWeight: '600' },
  userCardDeleteBtn: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(255,71,87,0.1)', borderRadius: 6 },
  userCardDeleteText: { color: '#ff4757', fontSize: 12, fontWeight: 'bold' },
  userSelfLabel: { color: '#2ed573', fontSize: 12, fontWeight: '600' }
});
