"""Verificação CRUZADA (opcional, fora do n8n): treina uma árvore do scikit-learn (CART/Gini)
com a MESMA divisão treino/teste do workflow e compara a acurácia. Não faz parte do sistema.
Uso: python tests/verificacao_sklearn.py <split.json>   (requer pandas e scikit-learn)"""
import json, sys
import pandas as pd
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, confusion_matrix
df = pd.read_csv('dados/rodomax_demandas.csv')
df['frete_por_km'] = (df.frete_ton / df.distancia_km).round(4)
X = pd.get_dummies(df[['produto', 'uf_origem', 'destino', 'balanca', 'distancia_km', 'frete_ton', 'saldo_ton', 'estrada_chao_km', 'antecedencia_h', 'frete_por_km']])
y = df.atendida
s = json.load(open(sys.argv[1]))
tr = df.id_demanda.isin(s['treino']); te = df.id_demanda.isin(s['teste'])
for prof in (3, 4, 5):
    m = DecisionTreeClassifier(criterion='gini', max_depth=prof, min_samples_leaf=5, min_samples_split=10, random_state=0).fit(X[tr], y[tr])
    p = m.predict(X[te])
    print(f'profundidade {prof}: acurácia teste = {accuracy_score(y[te], p):.3f}  matriz [sim,nao] = {confusion_matrix(y[te], p, labels=["sim","nao"]).tolist()}')
print('linha de base (sempre a classe majoritária do treino):', round((y[te] == y[tr].mode()[0]).mean(), 3))
