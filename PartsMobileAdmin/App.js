import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  FlatList, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, 
  Platform, Keyboard, Alert, ScrollView, Modal
} from 'react-native';
import * as FileSystem from 'expo-file-system';

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
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'part' | 'manage' | 'users'
  const [loading, setLoading] = useState(false);

  // Pro Search State
  const [searchMode, setSearchMode] = useState('universal'); // 'universal' | 'specs'
  const [universalSearchQuery, setUniversalSearchQuery] = useState('');
  const [specsSearchName, setSpecsSearchName] = useState('');
  const [specsSearchValue, setSpecsSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPartDetail, setSelectedPartDetail] = useState(null);

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
          setActiveTab('search');
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

  const handleUniversalSearch = async (text) => {
    setUniversalSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await apiCall(`/api/parts/search?q=${encodeURIComponent(text.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data || []);
      }
    } catch (e) {
      console.log("Universal search error:", e);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSpecsSearch = async () => {
    if (!specsSearchName.trim() && !specsSearchValue.trim()) {
      Alert.alert("Input Required", "Please enter a Part Name or Dimensions.");
      return;
    }
    Keyboard.dismiss();
    setSearchLoading(true);
    try {
      const res = await apiCall(`/api/parts/specs?partName=${encodeURIComponent(specsSearchName.trim())}&specValue=${encodeURIComponent(specsSearchValue.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data || []);
      }
    } catch (e) {
      console.log("Specs search error:", e);
    } finally {
      setSearchLoading(false);
    }
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
            style={[styles.tab, activeTab === 'search' && styles.activeTab]} 
            onPress={() => setActiveTab('search')}
          >
            <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>Search</Text>
          </TouchableOpacity>

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
          
          {/* TAB 0: SEARCH CATALOG */}
          {activeTab === 'search' && (
            <View style={{ flex: 1, paddingHorizontal: 20 }}>
              {/* Pro Search Tabs */}
              <View style={styles.searchSegmentContainer}>
                <TouchableOpacity 
                  style={[styles.searchSegmentButton, searchMode === 'universal' && styles.searchSegmentButtonActive]}
                  onPress={() => { setSearchMode('universal'); setSearchResults([]); }}
                >
                  <Text style={[styles.searchSegmentText, searchMode === 'universal' && styles.searchSegmentTextActive]}>
                    🔍 Universal Search
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.searchSegmentButton, searchMode === 'specs' && styles.searchSegmentButtonActive]}
                  onPress={() => { setSearchMode('specs'); setSearchResults([]); }}
                >
                  <Text style={[styles.searchSegmentText, searchMode === 'specs' && styles.searchSegmentTextActive]}>
                    ⚙️ Dimensions Search
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Universal Search Inputs */}
              {searchMode === 'universal' ? (
                <View style={styles.searchBoxContainer}>
                  <View style={styles.searchBarWrapper}>
                    <TextInput
                      style={styles.searchBarInput}
                      placeholder="Type Part #, Vehicle Model, Engine..."
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={universalSearchQuery}
                      onChangeText={handleUniversalSearch}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {universalSearchQuery.length > 0 && (
                      <TouchableOpacity 
                        style={styles.clearSearchInputBtn}
                        onPress={() => handleUniversalSearch('')}
                      >
                        <Text style={styles.clearSearchInputText}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.searchTipText}>Search is real-time and updates as you type.</Text>
                </View>
              ) : (
                <View style={styles.searchSpecsCard}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Part Name / Category</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. C.V. Joint or Brake Pad"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={specsSearchName}
                      onChangeText={setSpecsSearchName}
                      onSubmitEditing={handleSpecsSearch}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Dimensions / Spec Values</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 25 22 50 or 25*22*50"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={specsSearchValue}
                      onChangeText={setSpecsSearchValue}
                      onSubmitEditing={handleSpecsSearch}
                    />
                  </View>
                  <TouchableOpacity style={styles.searchProBtn} onPress={handleSpecsSearch}>
                    <Text style={styles.searchProBtnText}>Advanced Dimension Search</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Search Results List */}
              {searchLoading ? (
                <View style={[styles.center, { flex: 1 }]}>
                  <ActivityIndicator size="large" color="#e0aaff" />
                </View>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id.toString()}
                  contentContainerStyle={{ paddingBottom: 40, paddingTop: 10 }}
                  ListEmptyComponent={
                    (universalSearchQuery.trim() || (specsSearchName.trim() || specsSearchValue.trim())) ? (
                      <Text style={styles.emptyListText}>No parts found matching query.</Text>
                    ) : (
                      <View style={styles.emptySearchContainer}>
                        <Text style={styles.emptySearchEmoji}>🔍</Text>
                        <Text style={styles.emptySearchTitle}>Catalog Explorer</Text>
                        <Text style={styles.emptySearchSubtitle}>Enter a search term above to begin browsing your automotive catalog.</Text>
                      </View>
                    )
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
                      <TouchableOpacity 
                        style={styles.searchItemCard}
                        onPress={() => setSelectedPartDetail(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.searchCardHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.searchCardNum}>{item.part_number}</Text>
                            <Text style={styles.searchCardName}>{item.name}</Text>
                          </View>
                          <View style={[styles.itemBadge, isOem ? styles.badgeOem : styles.badgeGenuine]}>
                            <Text style={[styles.badgeText, isOem ? styles.badgeTextOem : styles.badgeTextGenuine]}>
                              {isOem ? `OEM` : "Genuine"}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.searchCardCategory}>Category: {item.category}</Text>

                        {/* Top Specifications Preview */}
                        {Object.keys(parsedSpecs).length > 0 && (
                          <View style={styles.searchSpecsPreviewRow}>
                            {Object.entries(parsedSpecs).slice(0, 3).map(([key, val]) => (
                              <View key={key} style={styles.itemSpecBadge}>
                                <Text style={styles.itemSpecBadgeText}>{key}: {val}</Text>
                              </View>
                            ))}
                            {Object.keys(parsedSpecs).length > 3 && (
                              <Text style={styles.searchSpecsMoreText}>+{Object.keys(parsedSpecs).length - 3} more</Text>
                            )}
                          </View>
                        )}

                        {item.engine_type && (
                          <Text style={styles.searchCardFitment}>⚙️ Engine Fit: {item.engine_type}</Text>
                        )}

                        <View style={styles.searchCardActionRow}>
                          <Text style={styles.searchCardActionLink}>View Full Details →</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
          )}

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

        {/* PROFESSIONAL DETAIL VIEWER MODAL */}
        <Modal
          visible={selectedPartDetail !== null}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedPartDetail(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContentCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalHeaderTitle}>Part Specifications</Text>
                <TouchableOpacity 
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedPartDetail(null)}
                >
                  <Text style={styles.modalCloseBtnText}>×</Text>
                </TouchableOpacity>
              </View>

              {selectedPartDetail && (
                <ScrollView contentContainerStyle={styles.modalScrollBody}>
                  {/* Part Summary Header */}
                  <View style={styles.modalSummaryHeader}>
                    <Text style={styles.modalPartNum}>{selectedPartDetail.part_number}</Text>
                    <Text style={styles.modalPartName}>{selectedPartDetail.name}</Text>
                    
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' }}>
                      <View style={[styles.itemBadge, selectedPartDetail.part_type === 'OEM' ? styles.badgeOem : styles.badgeGenuine]}>
                        <Text style={[styles.badgeText, selectedPartDetail.part_type === 'OEM' ? styles.badgeTextOem : styles.badgeTextGenuine]}>
                          {selectedPartDetail.part_type === 'OEM' ? `OEM - ${selectedPartDetail.brand}` : "Genuine Part"}
                        </Text>
                      </View>
                      <Text style={styles.modalCategoryText}>In {selectedPartDetail.category}</Text>
                    </View>
                  </View>

                  {/* Description */}
                  {selectedPartDetail.description && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>📋 Description</Text>
                      <Text style={styles.modalDescText}>{selectedPartDetail.description}</Text>
                    </View>
                  )}

                  {/* Dimensions Table */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>📏 Technical Parameters</Text>
                    {(() => {
                      let specs = {};
                      if (selectedPartDetail.specifications) {
                        try { specs = JSON.parse(selectedPartDetail.specifications); } catch(e) {}
                      }
                      if (Object.keys(specs).length > 0) {
                        return (
                          <View style={styles.specsTable}>
                            {Object.entries(specs).map(([key, val]) => (
                              <View key={key} style={styles.specsTableRow}>
                                <Text style={styles.specsTableCellKey}>{key}</Text>
                                <Text style={styles.specsTableCellVal}>{val}</Text>
                              </View>
                            ))}
                          </View>
                        );
                      } else {
                        return <Text style={styles.modalEmptySectionText}>No dimensions listed for this part.</Text>;
                      }
                    })()}
                  </View>

                  {/* Compatibility and Engine Fit */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>🚗 Fits Vehicles / Engines</Text>
                    
                    {selectedPartDetail.engine_type && (
                      <View style={styles.modalFitmentPillRow}>
                        <View style={styles.engineFitmentPill}>
                          <Text style={styles.engineFitmentPillText}>⚙️ Engine: {selectedPartDetail.engine_type}</Text>
                        </View>
                      </View>
                    )}

                    {selectedPartDetail.vehicle_fits ? (
                      <Text style={styles.modalFitsText}>✓ {selectedPartDetail.vehicle_fits}</Text>
                    ) : (
                      <Text style={styles.modalEmptySectionText}>Universal application or unlisted vehicle models.</Text>
                    )}

                    {selectedPartDetail.part_type === 'OEM' && selectedPartDetail.compatible_genuine_numbers && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={styles.compatibilityLabel}>Genuine Interchange Numbers:</Text>
                        <Text style={styles.interchangeNumText}>{selectedPartDetail.compatible_genuine_numbers}</Text>
                      </View>
                    )}
                  </View>

                  {/* Control Action Buttons */}
                  <View style={styles.modalActionButtonsGroup}>
                    <TouchableOpacity 
                      style={styles.modalEditActionBtn}
                      onPress={() => {
                        const part = selectedPartDetail;
                        setSelectedPartDetail(null);
                        editPart(part);
                      }}
                    >
                      <Text style={styles.modalEditActionBtnText}>🔧 Edit Record</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.modalDeleteActionBtn}
                      onPress={() => {
                        const part = selectedPartDetail;
                        setSelectedPartDetail(null);
                        deletePart(part.id, part.part_number);
                      }}
                    >
                      <Text style={styles.modalDeleteActionBtnText}>🗑️ Delete Part</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

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
  userSelfLabel: { color: '#2ed573', fontSize: 12, fontWeight: '600' },

  // Pro Search Segment Tabs
  searchSegmentContainer: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(15,10,20,0.55)', 
    borderRadius: 10, 
    padding: 4, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 15
  },
  searchSegmentButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  searchSegmentButtonActive: { backgroundColor: '#7b2cbf' },
  searchSegmentText: { color: '#888', fontWeight: '600', fontSize: 13 },
  searchSegmentTextActive: { color: 'white' },

  // Search box and wrapper
  searchBoxContainer: { marginBottom: 15 },
  searchBarWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.15)',
    paddingRight: 10
  },
  searchBarInput: { 
    flex: 1,
    color: 'white', 
    paddingHorizontal: 15, 
    paddingVertical: 12, 
    fontSize: 14
  },
  clearSearchInputBtn: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  clearSearchInputText: { color: 'white', fontSize: 11, fontWeight: 'bold', top: -1 },
  searchTipText: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 6, fontStyle: 'italic' },

  // Specs card in Search Tab
  searchSpecsCard: {
    backgroundColor: 'rgba(15,10,20,0.55)', 
    padding: 20, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 15
  },
  searchProBtn: { 
    backgroundColor: '#7b2cbf', 
    padding: 12, 
    borderRadius: 8, 
    alignItems: 'center',
    marginTop: 5
  },
  searchProBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },

  // Empty placeholder
  emptySearchContainer: { alignItems: 'center', justifyContent: 'center', marginVertical: 60, paddingHorizontal: 20 },
  emptySearchEmoji: { fontSize: 48, marginBottom: 15 },
  emptySearchTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  emptySearchSubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // Search Results List Card
  searchItemCard: {
    backgroundColor: 'rgba(15,10,20,0.55)', 
    padding: 18, 
    borderRadius: 14, 
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.12)' 
  },
  searchCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  searchCardNum: { color: '#e0aaff', fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: 'bold' },
  searchCardName: { color: 'white', fontSize: 16, fontWeight: '600', marginTop: 3 },
  searchCardCategory: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 },
  searchSpecsPreviewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' },
  searchSpecsMoreText: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '600' },
  searchCardFitment: { color: '#4facfe', fontSize: 12, marginTop: 8, fontWeight: '500' },
  searchCardActionRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', marginTop: 12, paddingTop: 10, alignItems: 'flex-end' },
  searchCardActionLink: { color: '#e0aaff', fontSize: 12, fontWeight: 'bold' },

  // Modal styling
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContentCard: { 
    backgroundColor: '#0c0a0f', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)',
    height: '85%',
    padding: 20
  },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', paddingBottom: 15 },
  modalHeaderTitle: { color: 'white', fontSize: 18, fontWeight: '700' },
  modalCloseBtn: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  modalCloseBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 18, fontWeight: 'bold', top: -1 },
  modalScrollBody: { paddingVertical: 20, paddingBottom: 40 },
  modalSummaryHeader: { marginBottom: 20 },
  modalPartNum: { color: '#e0aaff', fontSize: 15, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: 'bold' },
  modalPartName: { color: 'white', fontSize: 20, fontWeight: '700', marginTop: 5 },
  modalCategoryText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  modalSection: { marginBottom: 24 },
  modalSectionTitle: { color: 'white', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  modalDescText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 20 },
  modalEmptySectionText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontStyle: 'italic' },
  specsTable: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' },
  specsTableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.01)' },
  specsTableCellKey: { flex: 1, padding: 10, color: 'rgba(255,255,255,0.5)', fontSize: 13, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)', fontWeight: '600' },
  specsTableCellVal: { flex: 1.5, padding: 10, color: 'white', fontSize: 13 },
  modalFitmentPillRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  engineFitmentPill: { backgroundColor: 'rgba(255, 159, 243, 0.1)', borderColor: 'rgba(255, 159, 243, 0.25)', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  engineFitmentPillText: { fontSize: 12, color: '#ff9ff3', fontWeight: '600' },
  modalFitsText: { color: '#4facfe', fontSize: 13, fontWeight: '500', lineHeight: 18 },
  compatibilityLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  interchangeNumText: { color: '#ffa502', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: 'bold' },
  modalActionButtonsGroup: { flexDirection: 'row', gap: 15, marginTop: 25 },
  modalEditActionBtn: { flex: 1.5, backgroundColor: '#7b2cbf', padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalEditActionBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  modalDeleteActionBtn: { flex: 1, backgroundColor: 'rgba(255,71,87,0.1)', borderColor: 'rgba(255,71,87,0.3)', borderWidth: 1, padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalDeleteActionBtnText: { color: '#ff4757', fontWeight: 'bold', fontSize: 14 }
});
