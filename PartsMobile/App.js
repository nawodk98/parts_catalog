
import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, SafeAreaView, KeyboardAvoidingView,
  Platform, Keyboard
} from 'react-native';

export default function App() {
  // Since you use a dynamic port on your PC, you can enter the URL manually here when testing on Android
  const [serverUrl, setServerUrl] = useState('http://192.168.1.XXX:54321');

  const [mode, setMode] = useState('part'); // 'part' | 'vehicle'
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Search State
  const [partQuery, setPartQuery] = useState('');
  const [vBrand, setVBrand] = useState('');
  const [vModel, setVModel] = useState('');
  const [vSubmodel, setVSubmodel] = useState('');
  const [vCategory, setVCategory] = useState('');

  const searchPartNumber = async () => {
    if (!partQuery.trim()) return;
    Keyboard.dismiss();
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`${serverUrl}/api/parts/search?q=${encodeURIComponent(partQuery)}`);
      const data = await res.json();
      setResults(data || []);
    } catch (e) {
      alert("Connection failed. Check your Server URL!");
      setResults([]);
    }
    setLoading(false);
  };

  const searchVehicle = async () => {
    if (!vBrand.trim() || !vModel.trim() || !vSubmodel.trim()) {
      alert("Brand, Model, and Submodel are required!");
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    setHasSearched(true);
    let url = `${serverUrl}/api/parts/vehicle?brand=${encodeURIComponent(vBrand)}&model=${encodeURIComponent(vModel)}&submodel=${encodeURIComponent(vSubmodel)}`;
    if (vCategory) url += `&category=${encodeURIComponent(vCategory)}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      setResults(data || []);
    } catch (e) {
      alert("Connection failed. Check your Server URL!");
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
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Parts <Text style={styles.titleHighlight}>Catalog</Text></Text>
          <TextInput
            style={styles.serverInput}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://YOUR_LOCAL_IP:PORT"
            placeholderTextColor="#888"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, mode === 'part' && styles.activeTab]}
            onPress={() => { setMode('part'); setResults([]); setHasSearched(false); }}
          >
            <Text style={[styles.tabText, mode === 'part' && styles.activeTabText]}>By Part #</Text>
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
                placeholder="Enter Part Number..."
                placeholderTextColor="#666"
                value={partQuery}
                onChangeText={setPartQuery}
                onSubmitEditing={searchPartNumber}
              />
              <TouchableOpacity style={styles.primaryButton} onPress={searchPartNumber}>
                <Text style={styles.buttonText}>Find Part</Text>
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
                <TextInput style={[styles.input, { flex: 1, marginLeft: 5 }]} placeholder="Category (Optional)" placeholderTextColor="#666" value={vCategory} onChangeText={setVCategory} />
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={searchVehicle}>
                <Text style={styles.buttonText}>Search Vehicle Parts</Text>
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
  serverInput: { marginTop: 10, width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', color: '#888', borderRadius: 8, padding: 8, fontSize: 13, textAlign: 'center' },
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
