import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Image, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Nécessaire pour les choix TYPE
import axios from 'axios';
import { POS_URL } from '@/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Tab = 'restaurant' | 'groups' | 'menus' | 'options';

export default function MenuAdminPage() {
    const [activeTab, setActiveTab] = useState<Tab>('groups');
    const [restaurantInfo, setRestaurantInfo] = useState<any>(null);
    const [groups, setGroups] = useState([]);
    const [options, setOptions] = useState([]);

    // --- Form States ---
    const [newGroupName, setNewGroupName] = useState('');
    const [menuData, setMenuData] = useState({
        name: '', price: '', group_menu: '', type: 'burger'
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        const token = await AsyncStorage.getItem("token");
        try {
            const resResto = await axios.get(`${POS_URL}/restaurant/api/my-restaurant/`, { headers: { Authorization: `Bearer ${token}` } });
            const resGroups = await axios.get(`${POS_URL}/menu/api/groups/`, { headers: { Authorization: `Bearer ${token}` } });
            const resOptions = await axios.get(`${POS_URL}/menu/api/options/`, { headers: { Authorization: `Bearer ${token}` } });
            
            setRestaurantInfo(resResto.data);
            setGroups(resGroups.data);
            setOptions(resOptions.data);
        } catch (e) { console.error(e); }
    };

    const handleCreateGroup = async () => {
        const token = await AsyncStorage.getItem("token");
        try {
            await axios.post(`${POS_URL}/menu/api/groups/`, {
                name: setNewGroupName,
                restaurant: restaurantInfo.id
            }, { headers: { Authorization: `Bearer ${token}` } });
            Alert.alert("Succès", "Groupe créé !");
            fetchInitialData();
        } catch (e) { Alert.alert("Erreur", "Vérifiez les données"); }
    };

    // --- Renderers ---

    const renderRestaurantManager = () => (
        <View style={styles.formCard}>
            <Text style={styles.label}>Nom du Restaurant</Text>
            <TextInput style={styles.input} value={restaurantInfo?.name} onChangeText={(t) => setRestaurantInfo({...restaurantInfo, name: t})} />
            <Text style={styles.label}>Adresse</Text>
            <TextInput style={[styles.input, {height: 80}]} multiline value={restaurantInfo?.address} />
            <TouchableOpacity style={styles.saveBtn}><Text style={styles.btnText}>Mettre à jour le profil</Text></TouchableOpacity>
        </View>
    );

    const renderGroupManager = () => (
        <View>
            <View style={styles.createBox}>
                <TextInput style={styles.input} placeholder="Nouveau groupe (ex: Burgers)" value={newGroupName} onChangeText={setNewGroupName} />
                <TouchableOpacity style={styles.addBtn} onPress={handleCreateGroup}><Text style={styles.btnText}>Ajouter Groupe</Text></TouchableOpacity>
            </View>
            {groups.map((g: any) => (
                <View key={g.id} style={styles.listItem}>
                    <Text style={styles.itemTitle}>{g.name}</Text>
                    <Text>{g.menus?.length || 0} articles</Text>
                </View>
            ))}
        </View>
    );

    const renderMenuManager = () => (
        <ScrollView>
             <View style={styles.formCard}>
                <Text style={styles.label}>Ajouter un article</Text>
                <TextInput style={styles.input} placeholder="Nom (ex: Big Mac)" />
                <TextInput style={styles.input} placeholder="Prix" keyboardType="numeric" />
                <Text style={styles.label}>Groupe</Text>
                <Picker 
                    selectedValue={menuData.group_menu}
                    onValueChange={(v) => setMenuData({...menuData, group_menu: v})}
                >
                    {groups.map((g: any) => <Picker.Item key={g.id} label={g.name} value={g.id} />)}
                </Picker>
                <TouchableOpacity style={styles.addBtn}><Text style={styles.btnText}>Créer l'article</Text></TouchableOpacity>
             </View>
        </ScrollView>
    );

    return (
        <View style={styles.container}>
            <View style={styles.sidebar}>
                <Text style={styles.adminTitle}>Administration</Text>
                {(['restaurant', 'groups', 'menus', 'options'] as Tab[]).map((tab) => (
                    <TouchableOpacity 
                        key={tab} 
                        style={[styles.tabBtn, activeTab === tab && styles.activeTab]} 
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab.toUpperCase()}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.content}>
                <Text style={styles.sectionTitle}>Gestion des {activeTab}</Text>
                {activeTab === 'restaurant' && renderRestaurantManager()}
                {activeTab === 'groups' && renderGroupManager()}
                {activeTab === 'menus' && renderMenuManager()}
                {/* Implémenter OptionManager de la même manière */}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, flexDirection: 'row', backgroundColor: '#F0F2F5' },
    sidebar: { width: 250, backgroundColor: '#FFF', padding: 20, borderRightWidth: 1, borderColor: '#DDD' },
    adminTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 30, color: '#2C3E50' },
    tabBtn: { padding: 15, borderRadius: 8, marginBottom: 10 },
    activeTab: { backgroundColor: '#007BFF' },
    tabText: { fontWeight: '600', color: '#555' },
    activeTabText: { color: '#FFF' },
    content: { flex: 1, padding: 30 },
    sectionTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    formCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 12, elevation: 2 },
    label: { fontSize: 14, color: '#666', marginBottom: 8, marginTop: 10 },
    input: { borderWidth: 1, borderColor: '#DDD', padding: 12, borderRadius: 8, fontSize: 16 },
    saveBtn: { backgroundColor: '#28A745', padding: 15, borderRadius: 8, marginTop: 20, alignItems: 'center' },
    addBtn: { backgroundColor: '#007BFF', padding: 15, borderRadius: 8, marginTop: 10, alignItems: 'center' },
    btnText: { color: '#FFF', fontWeight: 'bold' },
    createBox: { marginBottom: 30 },
    listItem: { backgroundColor: '#FFF', padding: 15, borderRadius: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemTitle: { fontWeight: 'bold', fontSize: 16 }
});