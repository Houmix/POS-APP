import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router'; // Assure-toi d'utiliser un routeur comme celui de Next.js ou React Navigation

export default function ConfirmationPage() {
  const router = useRouter(); // Utilise le hook de routeur pour la redirection

  useEffect(() => {
    // Redirige après 5 secondes
    const timer = setTimeout(() => {
      router.push("/tabs/terminal"); // Remplace "/" par l'URL de ta page d'accueil
    }, 5000);

    // Nettoyage du timer lorsqu'on quitte la page
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Commande Confirmée !</Text>
      <Text style={styles.message}>Votre commande a été prise en charge. Vous serez redirigé vers la page d'accueil dans quelques secondes.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'green',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: 'black',
    textAlign: 'center',
  },
});
