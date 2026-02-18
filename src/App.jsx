import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Transposer } from 'chord-transposer'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// --- COMPONENTE: ITEM DEL PLAN ---
function ItemSortable({ c, cancionAbierta, setCancionAbierta, quitarDelSetlist, cambiarCategoria, modoLectura }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const [misSemitonos, setMisSemitonos] = useState(0);
  const estaAbierta = cancionAbierta === c.id;

  const transponerIndividual = (texto, cantidad) => {
    if (!texto || cantidad === 0) return texto;
    try { return Transposer.transpose(texto).up(cantidad).toString(); } 
    catch (e) { return texto; }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.6 : 1,
    marginBottom: '8px',
    borderRadius: '8px',
    border: '1px solid #333',
    backgroundColor: '#111',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={estaAbierta ? estilos.headerActivo : estilos.headerNormal}>
        <div style={estilos.infoCuerpo}>
          {!modoLectura && <span {...attributes} {...listeners} style={estilos.manubrio}>☰</span>}
          
          <div style={{flex: 1}} onClick={() => setCancionAbierta(estaAbierta ? null : c.id)}>
            <div style={{fontSize: '0.9rem', color: '#fff'}}>
                {c.categoria && <span style={estilos.tag}>{c.categoria}</span>} {c.titulo} 
                <b style={{color: '#4da6ff', marginLeft: '5px'}}>{transponerIndividual(c.tono || c.key, misSemitonos)}</b>
            </div>
          </div>
        </div>
        
        <div style={{display: 'flex', gap: '5px', alignItems: 'center'}}>
           {!modoLectura && (
             <>
                <select value={c.categoria || ""} onChange={(e) => cambiarCategoria(c.id, e.target.value)} style={estilos.miniSelect}>
                    <option value="">Tipo...</option>
                    {["Bienvenida", "Alabanza", "Adoración", "Ofrenda", "Despedida"].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <button onClick={() => quitarDelSetlist(c.id)} style={estilos.btnX}>×</button>
             </>
           )}
        </div>
      </div>

      {estaAbierta && (
        <div style={estilos.contenido}>
          <div style={estilos.controlesLetra}>
            <div style={estilos.transporte}>
                <button onClick={() => setMisSemitonos(s => s - 1)} style={estilos.btnT}>-</button>
                <span style={{fontSize: '0.9rem', color: '#fff'}}>{misSemitonos}</span>
                <button onClick={() => setMisSemitonos(s => s + 1)} style={estilos.btnT}>+</button>
            </div>
          </div>
          <pre style={estilos.letraPre}>{transponerIndividual(c.letra || c.lyrics, misSemitonos)}</pre>
        </div>
      )}
    </div>
  );
}

// --- APP PRINCIPAL ---
export default function App() {
  const [pantalla, setPantalla] = useState('principal'); // 'principal' o 'ensayo'
  const [fecha, setFecha] = useState(new Date());
  const [director, setDirector] = useState("");
  const [canciones, setCanciones] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cancionAbierta, setCancionAbierta] = useState(null);
  const [setlist, setSetlist] = useState([]);
  const [existePlan, setExistePlan] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('Alabanza');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fechaLegible = fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    const cargarDatos = async () => {
      const { data } = await supabase.from('CANCIONES').select('*').order('titulo', { ascending: true });
      if (data) setCanciones(data.map((c, i) => ({ ...c, id: c.id || `id-${i}` })));
    };
    cargarDatos();
  }, []);

  useEffect(() => {
    const cargarPlan = async () => {
      const fechaISO = fecha.toISOString().split('T')[0];
      const { data } = await supabase.from('planes_culto').select('*').eq('fecha', fechaISO).maybeSingle();
      if (data) {
        setDirector(data.director || "");
        setSetlist(data.canciones || []);
        setExistePlan(true);
      } else {
        setDirector(""); setSetlist([]); setExistePlan(false);
      }
    };
    cargarPlan();
  }, [fecha]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setSetlist((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const cambiarCategoria = (id, cat) => {
    setSetlist(setlist.map(item => item.id === id ? { ...item, categoria: cat } : item));
  };

  const guardar = async () => {
    const fechaISO = fecha.toISOString().split('T')[0];
    const { error } = await supabase.from('planes_culto').upsert({ fecha: fechaISO, director, canciones: setlist });
    if (error) alert("Error: " + error.message);
    else { alert("¡Plan guardado!"); setExistePlan(true); }
  };

  const compartirWhatsApp = () => {
    let texto = `🎸 *ORDEN DE CULTO - ODRE NUEVO*\n📅 *${fechaLegible.toUpperCase()}*\n👤 *Dirige:* ${director || '---'}\n\n`;
    const categorias = ["Bienvenida", "Alabanza", "Adoración", "Ofrenda", "Despedida"];
    categorias.forEach(cat => {
        const filtradas = setlist.filter(c => c.categoria === cat);
        if (filtradas.length > 0) {
            texto += `*${cat.toUpperCase()}*:\n`;
            filtradas.forEach(c => { texto += `• ${c.titulo.toUpperCase()} (${c.tono || c.key})\n`; });
            texto += `\n`;
        }
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  // --- VISTA MODO ENSAYO ---
  if (pantalla === 'ensayo') {
    return (
      <div style={estilos.fondo}>
        <div style={estilos.navEnsayo}>
            <button onClick={() => setPantalla('principal')} style={estilos.btnRegresar}>← Volver</button>
            <div style={{textAlign: 'right'}}>
                <div style={{fontSize: '0.7rem', color: '#4da6ff'}}>MODO ENSAYO</div>
                <div style={{fontSize: '0.8rem', fontWeight: 'bold'}}>{director}</div>
            </div>
        </div>

        <h3 style={{textTransform: 'capitalize', textAlign: 'center', fontSize: '1rem', margin: '20px 0'}}>{fechaLegible}</h3>

        <div style={{maxWidth: '600px', margin: '0 auto'}}>
            {setlist.length === 0 ? <p style={{textAlign: 'center', color: '#666'}}>No hay cantos en este plan.</p> : (
                setlist.map(c => (
                    <ItemSortable 
                        key={c.id} c={c} cancionAbierta={cancionAbierta} 
                        setCancionAbierta={setCancionAbierta}
                        modoLectura={true}
                    />
                ))
            )}
        </div>
      </div>
    );
  }

  // --- VISTA PRINCIPAL (EDICIÓN) ---
  return (
    <div style={estilos.fondo}>
      <h2 style={estilos.logo}>🎸 Odre Nuevo</h2>
      
      <div style={estilos.cajaBlanca}>
        <Calendar onChange={setFecha} value={fecha} className="mini-cal" />
        <input type="text" placeholder="Nombre del Director..." value={director} 
               onChange={(e) => setDirector(e.target.value)} style={estilos.inputDir} />
      </div>

      <div style={estilos.botonesAccion}>
        <button onClick={() => setPantalla('ensayo')} style={estilos.btnEnsayo}>📖 ABRIR MODO ENSAYO</button>
      </div>

      <input type="text" placeholder="🔍 Buscar alabanza..." value={busqueda} 
             onChange={(e) => setBusqueda(e.target.value)} style={estilos.search} />

      <div style={{maxWidth: '600px', margin: '0 auto'}}>
        <div style={estilos.headerPlan}>
            <h4 style={estilos.seccionTitle}>PLAN: {fechaLegible}</h4>
            {setlist.length > 0 && <button onClick={compartirWhatsApp} style={estilos.btnWhatsApp}>📱 WhatsApp</button>}
        </div>
        
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={setlist.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {setlist.map(c => (
              <ItemSortable 
                key={c.id} c={c} cancionAbierta={cancionAbierta} 
                setCancionAbierta={setCancionAbierta}
                cambiarCategoria={cambiarCategoria}
                quitarDelSetlist={(id) => setSetlist(setlist.filter(x => x.id !== id))} 
              />
            ))}
          </SortableContext>
        </DndContext>

        <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
          <button onClick={guardar} style={estilos.btnG}>💾 GUARDAR PLAN</button>
        </div>

        <div style={estilos.divisor}>BIBLIOTECA</div>
        <div style={estilos.tabs}>
            <button onClick={() => setFiltroTipo('Alabanza')} style={filtroTipo === 'Alabanza' ? estilos.tabActiva : estilos.tabInactiva}>ALABANZA</button>
            <button onClick={() => setFiltroTipo('Adoración')} style={filtroTipo === 'Adoración' ? estilos.tabActiva : estilos.tabInactiva}>ADORACIÓN</button>
        </div>

        {canciones.filter(c => (c.titulo + c.artista).toLowerCase().includes(busqueda.toLowerCase())).filter(c => (c.tipo || 'Alabanza') === filtroTipo).map(c => (
          <div key={c.id} style={estilos.itemRepo}>
            <div style={{flex: 1}}>
              <div style={{fontSize: '0.85rem', fontWeight: 'bold'}}>{c.titulo} ({c.tono})</div>
              <div style={{fontSize: '0.65rem', color: '#666'}}>{c.artista}</div>
            </div>
            <button onClick={() => setSetlist([...setlist, {...c, id: Date.now().toString(), categoria: ''}])} style={estilos.btnP}>+</button>
          </div>
        ))}
      </div>
    </div>
  )
}

const estilos = {
  fondo: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '15px', fontFamily: 'sans-serif' },
  logo: { textAlign: 'center', color: '#4da6ff', marginBottom: '15px' },
  cajaBlanca: { background: '#fff', padding: '15px', borderRadius: '15px', marginBottom: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  inputDir: { width: '90%', padding: '10px', marginTop: '10px', borderRadius: '8px', border: '1px solid #ccc', textAlign: 'center', color: '#000' },
  botonesAccion: { marginBottom: '15px', display: 'flex', justifyContent: 'center' },
  btnEnsayo: { background: '#3b82f6', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', width: '100%' },
  navEnsayo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '15px', borderBottom: '1px solid #333' },
  btnRegresar: { background: '#333', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '8px' },
  search: { width: '100%', padding: '12px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '10px', marginBottom: '15px', boxSizing: 'border-box' },
  headerPlan: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  seccionTitle: { color: '#4da6ff', fontSize: '0.75rem', margin: 0 },
  btnWhatsApp: { background: '#25D366', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.8rem' },
  headerNormal: { display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#161616', borderRadius: '8px' },
  headerActivo: { display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#1e3a8a', borderRadius: '8px 8px 0 0' },
  infoCuerpo: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1 },
  manubrio: { cursor: 'grab', fontSize: '1.5rem', color: '#444', padding: '0 5px' },
  tag: { background: '#4da6ff', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold', marginRight: '8px', textTransform: 'uppercase' },
  miniSelect: { background: '#222', color: '#fff', border: 'none', fontSize: '0.7rem', padding: '5px', borderRadius: '5px' },
  btnX: { background: 'none', border: 'none', color: '#ff4d4d', fontSize: '1.2rem', marginLeft: '10px' },
  contenido: { padding: '15px', background: '#050505', border: '1px solid #1e3a8a', borderRadius: '0 0 8px 8px' },
  controlesLetra: { display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' },
  transporte: { display: 'flex', alignItems: 'center', gap: '10px', background: '#222', padding: '5px 10px', borderRadius: '20px' },
  btnT: { background: 'none', border: 'none', color: '#4da6ff', fontSize: '1.2rem', fontWeight: 'bold' },
  letraPre: { whiteSpace: 'pre-wrap', fontSize: '1.1rem', color: '#ddd', lineHeight: '1.6', fontFamily: 'monospace' },
  btnG: { width: '100%', padding: '15px', background: '#10b981', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold' },
  divisor: { textAlign: 'center', margin: '30px 0 15px', color: '#444', fontSize: '0.7rem', letterSpacing: '2px' },
  tabs: { display: 'flex', gap: '5px', marginBottom: '15px' },
  tabActiva: { flex: 1, padding: '12px', background: '#4da6ff', border: 'none', borderRadius: '8px', fontWeight: 'bold', color: '#000' },
  tabInactiva: { flex: 1, padding: '12px', background: '#111', color: '#555', border: '1px solid #333', borderRadius: '8px' },
  itemRepo: { display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#111', borderRadius: '10px', marginBottom: '8px' },
  btnP: { background: '#3b82f6', border: 'none', color: '#fff', width: '35px', height: '35px', borderRadius: '50%', fontWeight: 'bold' }
}