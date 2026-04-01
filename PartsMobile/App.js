import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  FlatList, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, 
  Platform, Keyboard, Alert
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';

let db = null;

export default function App() {
  const [serverUrl, setServerUrl] = useState('http://192.168.1.XXX:54321');
  
  const [mode, setMode] = useState('part'); // 'part' | 'vehicle'
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Search State
  const [partQuery, setPartQuery] = useState('');
  const [vBrand, setVBrand] = useState('');
  const [vModel, setVModel] = useState('');
  const [vSubmodel, setVSubmodel] = useState('');
  const [vEngine, setVEngine] = useState('');
  const [vCategory, setVCategory] = useState('');

  // Initialize DB on App Start
  useEffect(() => {
    initDb();
  }, []);

  const initDb = async () => {
    try {
      if (SQLite.openDatabaseSync) {
        db = SQLite.openDatabaseSync('parts.sqlite');
      } else if (SQLite.openDatabaseAsync) {
        db = await SQLite.openDatabaseAsync('parts.sqlite');
      } else {
        db = SQLite.openDatabase('parts.sqlite');
      }
    } catch (e) {
      console.error("Failed to initialize database:", e);
    }
  };

  const syncDatabase = async () => {
    if (!serverUrl || serverUrl.includes('XXX')) {
      Alert.alert("Invalid URL", "Please enter your laptop's correct IP address and port.");
      return;
    }

    setSyncing(true);
    try {
      const dbName = 'parts.sqlite';
      let rawDir = SQLite.defaultDatabaseDirectory ? SQLite.defaultDatabaseDirectory : FileSystem.documentDirectory + 'SQLite';
      
      // FileSystem methods REQUIRE the file:// prefix, but SQLite.defaultDatabaseDirectory sometimes doesn't have it
      let dbDir = rawDir.startsWith('file://') ? rawDir : `file://${rawDir}`;

      const dirInfo = await FileSystem.getInfoAsync(dbDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
      }
      
      const dbPath = dbDir + (dbDir.endsWith('/') ? '' : '/') + dbName;
      
      // Close existing DB if open to prevent locking
      if (db) {
         if (db.closeAsync) await db.closeAsync();
         else if (db.close) db.close();
         db = null;
      }

      const downloadRes = await FileSystem.downloadAsync(`${serverUrl}/api/database/download`, dbPath);
      
      if (downloadRes.status !== 200) {
          throw new Error("Failed connecting to server");
      }
      
      await initDb();
      Alert.alert("Success", "Database downloaded! You can now search offline.");
    } catch(e) {
      Alert.alert("Sync Error", e.message);
    }
    setSyncing(false);
  };

  const executeQuery = async (query, params = []) => {
    if (!db) await initDb();
    
    return new Promise(async (resolve, reject) => {
        if (!db) return reject("Database not loaded. Please sync data first.");

        if (db.getAllAsync) {
            // New Expo SQLite API
            try {
                const res = await db.getAllAsync(query, params);
                resolve(res);
            } catch (e) {
                reject(e);
            }
        } else {
            // Old Expo SQLite API
            db.transaction(tx => {
                tx.executeSql(query, params, (_, { rows }) => {
                    resolve(rows._array || rows);
                }, (_, error) => {
                    reject(error);
                    return true;
                });
            });
        }
    });
  };

  const searchPartNumber = async () => {
    if (!partQuery.trim()) return;
    Keyboard.dismiss();
    setLoading(true);
    setHasSearched(true);
    
    try {
      const query = `
          SELECT p.*,
                 (CASE WHEN p.engine_type IS NOT NULL AND p.engine_type != '' THEN 'Engine: ' || p.engine_type ELSE '' END) as engine_fitment,
                 GROUP_CONCAT(DISTINCT UPPER(v.brand) || ' ' || v.model || ' ' || v.submodel || COALESCE(' ' || NULLIF(v.engine_type, ''), '')) as vehicle_fits
          FROM parts p
          LEFT JOIN part_compatibility pc ON p.id = pc.oem_part_id
          LEFT JOIN parts gp ON pc.genuine_part_number = gp.part_number
          LEFT JOIN vehicles v ON p.vehicle_id = v.id OR gp.vehicle_id = v.id
          WHERE p.part_number LIKE ? 
             OR p.name LIKE ?
             OR p.description LIKE ?
             OR p.brand LIKE ?
             OR p.engine_type LIKE ?
             OR v.brand LIKE ?
             OR v.model LIKE ?
             OR v.submodel LIKE ?
             OR v.engine_type LIKE ?
             OR pc.genuine_part_number LIKE ?
             OR p.part_number IN (
                 SELECT pc2.genuine_part_number 
                 FROM part_compatibility pc2 
                 JOIN parts p2 ON pc2.oem_part_id = p2.id 
                 WHERE p2.part_number LIKE ? 
                    OR p2.name LIKE ?
                    OR p2.description LIKE ?
             )
          GROUP BY p.id
      `;
      const q = `%${partQuery}%`;
      const params = [q, q, q, q, q, q, q, q, q, q, q, q, q];
      const res = await executeQuery(query, params);
      setResults(res || []);
    } catch (e) {
      if (e.message?.includes('no such table') || e.message?.includes('no such column')) {
         Alert.alert("Data Update Needed", "Please Sync Data from your laptop! The database schema has been upgraded.");
      } else {
         Alert.alert("Search Error", JSON.stringify(e.message || e));
      }
      setResults([]);
    }
    setLoading(false);
  };

  const searchVehicle = async () => {
    if (!vBrand.trim() || !vModel.trim() || !vSubmodel.trim()) {
      Alert.alert("Required", "Brand, Model, and Submodel are required!");
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    setHasSearched(true);

    try {
      let vQuery = `SELECT id, engine_type FROM vehicles WHERE LOWER(brand) = ? AND model = ? AND submodel = ?`;
      let vParams = [vBrand.toLowerCase(), vModel, vSubmodel];
      
      if (vEngine.trim()) {
          vQuery += ` AND engine_type = ? COLLATE NOCASE`;
          vParams.push(vEngine.trim());
      }
      
      const vRes = await executeQuery(vQuery, vParams);
      
      if (vRes.length === 0 && !vEngine.trim()) {
          setResults([]);
          setLoading(false);
          return;
      }
      
      const conditions = [];
      let params = [];

      if (vRes.length > 0) {
          const vehicleId = vRes[0].id;
          const vehicleEngine = vRes[0].engine_type;
          conditions.push(`(p.vehicle_id = ?)`);
          conditions.push(`(pc.genuine_part_number IN (SELECT part_number FROM parts WHERE vehicle_id = ?))`);
          params.push(vehicleId, vehicleId);
          if (vehicleEngine) {
              conditions.push(`(p.engine_type = ? COLLATE NOCASE AND p.engine_type != '')`);
              params.push(vehicleEngine);
          }
      }

      if (vEngine.trim()) {
          conditions.push(`(p.engine_type = ? COLLATE NOCASE AND p.engine_type != '')`);
          params.push(vEngine.trim());
      }
      
      if (conditions.length === 0) {
          setResults([]);
          setLoading(false);
          return;
      }
      
      let query = `
          SELECT p.*,
                 (CASE WHEN p.engine_type IS NOT NULL AND p.engine_type != '' THEN 'Engine: ' || p.engine_type ELSE '' END) as engine_fitment,
                 GROUP_CONCAT(DISTINCT UPPER(v.brand) || ' ' || v.model || ' ' || v.submodel || COALESCE(' ' || NULLIF(v.engine_type, ''), '')) as vehicle_fits
          FROM parts p
          LEFT JOIN part_compatibility pc ON p.id = pc.oem_part_id
          LEFT JOIN parts gp ON pc.genuine_part_number = gp.part_number
          LEFT JOIN vehicles v ON p.vehicle_id = v.id OR gp.vehicle_id = v.id
          WHERE 1=1 AND ( ${conditions.join(' OR ')} )
      `;

      if (vCategory && vCategory.toLowerCase() !== 'all') {
          query += ` AND LOWER(p.category) = ?`;
          params.push(vCategory.toLowerCase());
      }
      query += ` GROUP BY p.id`;

      const pRes = await executeQuery(query, params);
      setResults(pRes || []);
    } catch (e) {
      if (e.message?.includes('no such table') || e.message?.includes('no such column')) {
         Alert.alert("Data Update Needed", "Please Sync Data from your laptop! The database schema has been upgraded.");
      } else {
         Alert.alert("Search Error", JSON.stringify(e.message || e));
      }
      setResults([]);
    }
    setLoading(false);
  };

  const renderItem = ({ item }) => {
    const isOem = item.part_type === 'OEM';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.partName}>{item.name} <Text style={styles.partNum}>({item.part_number})</Text></Text>
        </View>
        
        <View style={styles.badgeRow}>
          {isOem ? (
            <View style={[styles.badge, styles.badgeOem]}>
              <Text style={styles.badgeOemText}>OEM - {item.brand}</Text>
            </View>
          ) : (
             <View style={[styles.badge, styles.badgeGenuine]}>
              <Text style={styles.badgeGenText}>Genuine</Text>
            </View>
          )}
          <Text style={styles.categoryText}>Category: {item.category}</Text>
        </View>

        {item.description ? (
          <Text style={styles.descText}>{item.description}</Text>
        ) : null}

        {item.vehicle_fits ? (
          <Text style={{color: '#4facfe', fontSize: 13, marginTop: 8, fontWeight: '500'}}>✓ Fits: {item.vehicle_fits}</Text>
        ) : null}

        {item.engine_fitment ? (
          <Text style={{color: '#ff9ff3', fontSize: 13, marginTop: 4, fontWeight: '500'}}>⚙️ {item.engine_fitment}</Text>
        ) : null}

        <TouchableOpacity style={{marginTop: 15, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, alignItems: 'center'}} onPress={() => {
            Alert.alert(
                "Part Details", 
                `Name: ${item.name}\nNumber: ${item.part_number}\nCategory: ${item.category}\n\nCompatible Vehicles:\n${item.vehicle_fits || 'None / Unknown'}\n\nFits Engine:\n${item.engine_fitment ? item.engine_fitment.replace('Engine: ', '') : 'Universal'}`
            );
        }}>
            <Text style={{color: 'white', fontWeight: 'bold'}}>View Details</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Parts <Text style={styles.titleHighlight}>Catalog</Text></Text>
          
          {/* Sync Header Section */}
          <View style={styles.syncContainer}>
             <TextInput 
              style={styles.serverInput}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://192.168.1.XXX:54321"
              placeholderTextColor="#888"
              autoCapitalize="none"
             />
             <TouchableOpacity style={styles.syncBtn} onPress={syncDatabase} disabled={syncing}>
                <Text style={styles.syncBtnText}>{syncing ? "Downloading..." : "Sync Data"}</Text>
             </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, mode === 'part' && styles.activeTab]} 
            onPress={() => { setMode('part'); setResults([]); setHasSearched(false); }}
          >
            <Text style={[styles.tabText, mode === 'part' && styles.activeTabText]}>Universal Search</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, mode === 'vehicle' && styles.activeTab]} 
            onPress={() => { setMode('vehicle'); setResults([]); setHasSearched(false); }}
          >
            <Text style={[styles.tabText, mode === 'vehicle' && styles.activeTabText]}>By Vehicle</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          {mode === 'part' ? (
            <View>
              <TextInput 
                style={styles.input} 
                placeholder="Enter Part #, Vehicle, or Engine..." 
                placeholderTextColor="#666"
                value={partQuery} 
                onChangeText={setPartQuery}
                onSubmitEditing={searchPartNumber}
              />
              <TouchableOpacity style={styles.primaryButton} onPress={searchPartNumber}>
                <Text style={styles.buttonText}>Find Part / Vehicle (Offline)</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1, marginRight: 5 }]} placeholder="Brand (e.g. Toyota)" placeholderTextColor="#666" value={vBrand} onChangeText={setVBrand} />
                <TextInput style={[styles.input, { flex: 1, marginLeft: 5 }]} placeholder="Model (e.g. Camry)" placeholderTextColor="#666" value={vModel} onChangeText={setVModel} />
              </View>
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1, marginRight: 5 }]} placeholder="Submodel (e.g. LE)" placeholderTextColor="#666" value={vSubmodel} onChangeText={setVSubmodel} />
                <TextInput style={[styles.input, { flex: 1, marginLeft: 5 }]} placeholder="Engine (e.g. 2KD)" placeholderTextColor="#666" value={vEngine} onChangeText={setVEngine} />
              </View>
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Category (Optional)" placeholderTextColor="#666" value={vCategory} onChangeText={setVCategory} />
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={searchVehicle}>
                <Text style={styles.buttonText}>Search Vehicle Parts (Offline)</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.resultsContainer}>
          {loading ? (
             <ActivityIndicator size="large" color="#4facfe" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={
                hasSearched ? <Text style={styles.emptyText}>No parts found. Try adjusting your search.</Text> : null
              }
            />
          )}
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { padding: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  title: { color: 'white', fontSize: 24, fontWeight: '700' },
  titleHighlight: { color: '#4facfe' },
  syncContainer: { flexDirection: 'row', marginTop: 15, width: '100%' },
  serverInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', color: '#888', borderRadius: 8, padding: 8, fontSize: 13, marginRight: 10 },
  syncBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 15, justifyContent: 'center', borderRadius: 8 },
  syncBtnText: { color: 'white', fontSize: 13, fontWeight: 'bold' },
  tabContainer: { flexDirection: 'row', margin: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, overflow: 'hidden', padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#4facfe' },
  tabText: { color: '#888', fontWeight: '600' },
  activeTabText: { color: 'white' },
  searchContainer: { paddingHorizontal: 20 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', borderRadius: 10, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#1e293b' },
  row: { flexDirection: 'row' },
  primaryButton: { backgroundColor: '#4facfe', padding: 15, borderRadius: 10, alignItems: 'center', shadowColor: '#4facfe', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  resultsContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  card: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#1e293b' },
  cardHeader: { marginBottom: 10 },
  partName: { color: 'white', fontSize: 18, fontWeight: '600' },
  partNum: { color: '#888', fontSize: 14, fontWeight: 'normal' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 10 },
  badgeOem: { backgroundColor: 'rgba(255, 165, 2, 0.2)' },
  badgeGenuine: { backgroundColor: 'rgba(46, 213, 115, 0.2)' },
  badgeOemText: { color: '#ffa502', fontSize: 12, fontWeight: 'bold' },
  badgeGenText: { color: '#2ed573', fontSize: 12, fontWeight: 'bold' },
  categoryText: { color: '#888', fontSize: 13 },
  descText: { color: '#aaa', fontSize: 13, lineHeight: 18, marginTop: 5 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 40, fontSize: 16 }
});
