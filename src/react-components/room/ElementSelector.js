import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { FormattedMessage } from "react-intl";
import styles from "./ElementSelector.scss";

// 118 elements grouped by atomic number, matching the server's chemistry module.
const ELEMENTS = [
  { symbol: "H", name: "Wasserstoff", number: 1, group: 1, period: 1, block: "s", group_type: "nonmetal" },
  { symbol: "He", name: "Helium", number: 2, group: 18, period: 1, block: "s", group_type: "nobleGas" },
  { symbol: "Li", name: "Lithium", number: 3, group: 1, period: 2, block: "s", group_type: "alkali" },
  { symbol: "Be", name: "Beryllium", number: 4, group: 2, period: 2, block: "s", group_type: "alkalineEarth" },
  { symbol: "B", name: "Bor", number: 5, group: 13, period: 2, block: "p", group_type: "metalloid" },
  { symbol: "C", name: "Kohlenstoff", number: 6, group: 14, period: 2, block: "p", group_type: "nonmetal" },
  { symbol: "N", name: "Stickstoff", number: 7, group: 15, period: 2, block: "p", group_type: "nonmetal" },
  { symbol: "O", name: "Sauerstoff", number: 8, group: 16, period: 2, block: "p", group_type: "nonmetal" },
  { symbol: "F", name: "Fluor", number: 9, group: 17, period: 2, block: "p", group_type: "halogen" },
  { symbol: "Ne", name: "Neon", number: 10, group: 18, period: 2, block: "p", group_type: "nobleGas" },
  { symbol: "Na", name: "Natrium", number: 11, group: 1, period: 3, block: "s", group_type: "alkali" },
  { symbol: "Mg", name: "Magnesium", number: 12, group: 2, period: 3, block: "s", group_type: "alkalineEarth" },
  { symbol: "Al", name: "Aluminium", number: 13, group: 13, period: 3, block: "p", group_type: "metal" },
  { symbol: "Si", name: "Silizium", number: 14, group: 14, period: 3, block: "p", group_type: "metalloid" },
  { symbol: "P", name: "Phosphor", number: 15, group: 15, period: 3, block: "p", group_type: "nonmetal" },
  { symbol: "S", name: "Schwefel", number: 16, group: 16, period: 3, block: "p", group_type: "nonmetal" },
  { symbol: "Cl", name: "Chlor", number: 17, group: 17, period: 3, block: "p", group_type: "halogen" },
  { symbol: "Ar", name: "Argon", number: 18, group: 18, period: 3, block: "p", group_type: "nobleGas" },
  { symbol: "K", name: "Kalium", number: 19, group: 1, period: 4, block: "s", group_type: "alkali" },
  { symbol: "Ca", name: "Calcium", number: 20, group: 2, period: 4, block: "s", group_type: "alkalineEarth" },
  { symbol: "Sc", name: "Scandium", number: 21, group: 3, period: 4, block: "d", group_type: "transition" },
  { symbol: "Ti", name: "Titan", number: 22, group: 4, period: 4, block: "d", group_type: "transition" },
  { symbol: "V", name: "Vanadium", number: 23, group: 5, period: 4, block: "d", group_type: "transition" },
  { symbol: "Cr", name: "Chrom", number: 24, group: 6, period: 4, block: "d", group_type: "transition" },
  { symbol: "Mn", name: "Mangan", number: 25, group: 7, period: 4, block: "d", group_type: "transition" },
  { symbol: "Fe", name: "Eisen", number: 26, group: 8, period: 4, block: "d", group_type: "transition" },
  { symbol: "Co", name: "Kobalt", number: 27, group: 9, period: 4, block: "d", group_type: "transition" },
  { symbol: "Ni", name: "Nickel", number: 28, group: 10, period: 4, block: "d", group_type: "transition" },
  { symbol: "Cu", name: "Kupfer", number: 29, group: 11, period: 4, block: "d", group_type: "transition" },
  { symbol: "Zn", name: "Zink", number: 30, group: 12, period: 4, block: "d", group_type: "transition" },
  { symbol: "Ga", name: "Gallium", number: 31, group: 13, period: 4, block: "p", group_type: "metal" },
  { symbol: "Ge", name: "Germanium", number: 32, group: 14, period: 4, block: "p", group_type: "metalloid" },
  { symbol: "As", name: "Arsen", number: 33, group: 15, period: 4, block: "p", group_type: "metalloid" },
  { symbol: "Se", name: "Selen", number: 34, group: 16, period: 4, block: "p", group_type: "nonmetal" },
  { symbol: "Br", name: "Brom", number: 35, group: 17, period: 4, block: "p", group_type: "halogen" },
  { symbol: "Kr", name: "Krypton", number: 36, group: 18, period: 4, block: "p", group_type: "nobleGas" },
  { symbol: "Rb", name: "Rubidium", number: 37, group: 1, period: 5, block: "s", group_type: "alkali" },
  { symbol: "Sr", name: "Strontium", number: 38, group: 2, period: 5, block: "s", group_type: "alkalineEarth" },
  { symbol: "Y", name: "Yttrium", number: 39, group: 3, period: 5, block: "d", group_type: "transition" },
  { symbol: "Zr", name: "Zirkonium", number: 40, group: 4, period: 5, block: "d", group_type: "transition" },
  { symbol: "Nb", name: "Niob", number: 41, group: 5, period: 5, block: "d", group_type: "transition" },
  { symbol: "Mo", name: "Molybdän", number: 42, group: 6, period: 5, block: "d", group_type: "transition" },
  { symbol: "Tc", name: "Technetium", number: 43, group: 7, period: 5, block: "d", group_type: "transition" },
  { symbol: "Ru", name: "Ruthenium", number: 44, group: 8, period: 5, block: "d", group_type: "transition" },
  { symbol: "Rh", name: "Rhodium", number: 45, group: 9, period: 5, block: "d", group_type: "transition" },
  { symbol: "Pd", name: "Palladium", number: 46, group: 10, period: 5, block: "d", group_type: "transition" },
  { symbol: "Ag", name: "Silber", number: 47, group: 11, period: 5, block: "d", group_type: "transition" },
  { symbol: "Cd", name: "Cadmium", number: 48, group: 12, period: 5, block: "d", group_type: "transition" },
  { symbol: "In", name: "Indium", number: 49, group: 13, period: 5, block: "p", group_type: "metal" },
  { symbol: "Sn", name: "Zinn", number: 50, group: 14, period: 5, block: "p", group_type: "metal" },
  { symbol: "Sb", name: "Antimon", number: 51, group: 15, period: 5, block: "p", group_type: "metalloid" },
  { symbol: "Te", name: "Tellur", number: 52, group: 16, period: 5, block: "p", group_type: "metalloid" },
  { symbol: "I", name: "Jod", number: 53, group: 17, period: 5, block: "p", group_type: "halogen" },
  { symbol: "Xe", name: "Xenon", number: 54, group: 18, period: 5, block: "p", group_type: "nobleGas" },
  { symbol: "Cs", name: "Cäsium", number: 55, group: 1, period: 6, block: "s", group_type: "alkali" },
  { symbol: "Ba", name: "Barium", number: 56, group: 2, period: 6, block: "s", group_type: "alkalineEarth" },
  { symbol: "La", name: "Lanthan", number: 57, group: 3, period: 6, block: "f", group_type: "lanthanide" },
  { symbol: "Ce", name: "Cer", number: 58, group: 3, period: 6, block: "f", group_type: "lanthanide" },
  { symbol: "Pr", name: "Praseodym", number: 59, group: 3, period: 6, block: "f", group_type: "lanthanide" },
  { symbol: "Nd", name: "Neodym", number: 60, group: 3, period: 6, block: "f", group_type: "lanthanide" },
  { symbol: "Pm", name: "Promethium", number: 61, group: 3, period: 6, block: "f", group_type: "lanthanide" },
  { symbol: "Sm", name: "Samarium", number: 62, group: 3, period: 6, block: "f", group_type: "lanthanide" },
  { symbol: "Eu", name: "Europium", number: 63, group: 3, period: 6, block: "f", group_type: "lanthanide" },
  { symbol: "Gd", name: "Gadolinium", number: 64, group: 3, period: 6, block: "f", group_type: "lanthanide" },
  { symbol: "Tb", name: "Terbium", number: 65, group: 3, period: 6, block: "f", group_type: "lanthanide" },
  { symbol: "Dy", name: "Dysprosium", number: 66, group: 3, period: 6, block: "f", group_type: "lanthanide" },
  { symbol: "Ho", name: "Holmium", number: 67, group: 3, period: 6, block: "f", group_type: "lanthanide" },
  { symbol: "Er", name: "Erbium", number: 68, group: 3, period: 6, block: "f", group_type: "lanthanide" },
  { symbol: "Tm", name: "Thulium", number: 69, group: 3, period: 6, block: "f", group_type: "lanthanide" },
  { symbol: "Yb", name: "Ytterbium", number: 70, group: 3, period: 6, block: "f", group_type: "lanthanide" },
  { symbol: "Lu", name: "Lutetium", number: 71, group: 3, period: 6, block: "f", group_type: "lanthanide" },
  { symbol: "Hf", name: "Hafnium", number: 72, group: 4, period: 6, block: "d", group_type: "transition" },
  { symbol: "Ta", name: "Tantal", number: 73, group: 5, period: 6, block: "d", group_type: "transition" },
  { symbol: "W", name: "Wolfram", number: 74, group: 6, period: 6, block: "d", group_type: "transition" },
  { symbol: "Re", name: "Rhenium", number: 75, group: 7, period: 6, block: "d", group_type: "transition" },
  { symbol: "Os", name: "Osmium", number: 76, group: 8, period: 6, block: "d", group_type: "transition" },
  { symbol: "Ir", name: "Iridium", number: 77, group: 9, period: 6, block: "d", group_type: "transition" },
  { symbol: "Pt", name: "Platin", number: 78, group: 10, period: 6, block: "d", group_type: "transition" },
  { symbol: "Au", name: "Gold", number: 79, group: 11, period: 6, block: "d", group_type: "transition" },
  { symbol: "Hg", name: "Quecksilber", number: 80, group: 12, period: 6, block: "d", group_type: "transition" },
  { symbol: "Tl", name: "Thallium", number: 81, group: 13, period: 6, block: "p", group_type: "metal" },
  { symbol: "Pb", name: "Blei", number: 82, group: 14, period: 6, block: "p", group_type: "metal" },
  { symbol: "Bi", name: "Wismut", number: 83, group: 15, period: 6, block: "p", group_type: "metalloid" },
  { symbol: "Po", name: "Polonium", number: 84, group: 16, period: 6, block: "p", group_type: "metalloid" },
  { symbol: "At", name: "Astatin", number: 85, group: 17, period: 6, block: "p", group_type: "halogen" },
  { symbol: "Rn", name: "Radon", number: 86, group: 18, period: 6, block: "p", group_type: "nobleGas" },
  { symbol: "Fr", name: "Francium", number: 87, group: 1, period: 7, block: "s", group_type: "alkali" },
  { symbol: "Ra", name: "Radium", number: 88, group: 2, period: 7, block: "s", group_type: "alkalineEarth" },
  { symbol: "Ac", name: "Actinium", number: 89, group: 3, period: 7, block: "f", group_type: "actinide" },
  { symbol: "Th", name: "Thorium", number: 90, group: 3, period: 7, block: "f", group_type: "actinide" },
  { symbol: "Pa", name: "Protactinium", number: 91, group: 3, period: 7, block: "f", group_type: "actinide" },
  { symbol: "U", name: "Uran", number: 92, group: 3, period: 7, block: "f", group_type: "actinide" },
  { symbol: "Np", name: "Neptunium", number: 93, group: 3, period: 7, block: "f", group_type: "actinide" },
  { symbol: "Pu", name: "Plutonium", number: 94, group: 3, period: 7, block: "f", group_type: "actinide" },
  { symbol: "Am", name: "Americium", number: 95, group: 3, period: 7, block: "f", group_type: "actinide" },
  { symbol: "Cm", name: "Curium", number: 96, group: 3, period: 7, block: "f", group_type: "actinide" },
  { symbol: "Bk", name: "Berkelium", number: 97, group: 3, period: 7, block: "f", group_type: "actinide" },
  { symbol: "Cf", name: "Californium", number: 98, group: 3, period: 7, block: "f", group_type: "actinide" },
  { symbol: "Es", name: "Einsteinium", number: 99, group: 3, period: 7, block: "f", group_type: "actinide" },
  { symbol: "Fm", name: "Fermium", number: 100, group: 3, period: 7, block: "f", group_type: "actinide" },
  { symbol: "Md", name: "Mendelevium", number: 101, group: 3, period: 7, block: "f", group_type: "actinide" },
  { symbol: "No", name: "Nobelium", number: 102, group: 3, period: 7, block: "f", group_type: "actinide" },
  { symbol: "Lr", name: "Lawrencium", number: 103, group: 3, period: 7, block: "f", group_type: "actinide" },
  { symbol: "Rf", name: "Rutherfordium", number: 104, group: 4, period: 7, block: "d", group_type: "transition" },
  { symbol: "Db", name: "Dubnium", number: 105, group: 5, period: 7, block: "d", group_type: "transition" },
  { symbol: "Sg", name: "Seaborgium", number: 106, group: 6, period: 7, block: "d", group_type: "transition" },
  { symbol: "Bh", name: "Bohrium", number: 107, group: 7, period: 7, block: "d", group_type: "transition" },
  { symbol: "Hs", name: "Hassium", number: 108, group: 8, period: 7, block: "d", group_type: "transition" },
  { symbol: "Mt", name: "Meitnerium", number: 109, group: 9, period: 7, block: "d", group_type: "transition" },
  { symbol: "Ds", name: "Darmstadtium", number: 110, group: 10, period: 7, block: "d", group_type: "transition" },
  { symbol: "Rg", name: "Roentgenium", number: 111, group: 11, period: 7, block: "d", group_type: "transition" },
  { symbol: "Cn", name: "Copernicium", number: 112, group: 12, period: 7, block: "d", group_type: "transition" },
  { symbol: "Nh", name: "Nihonium", number: 113, group: 13, period: 7, block: "p", group_type: "metal" },
  { symbol: "Fl", name: "Flerovium", number: 114, group: 14, period: 7, block: "p", group_type: "metal" },
  { symbol: "Mc", name: "Moscovium", number: 115, group: 15, period: 7, block: "p", group_type: "metal" },
  { symbol: "Lv", name: "Livermorium", number: 116, group: 16, period: 7, block: "p", group_type: "metal" },
  { symbol: "Ts", name: "Tennessin", number: 117, group: 17, period: 7, block: "p", group_type: "halogen" },
  { symbol: "Og", name: "Oganesson", number: 118, group: 18, period: 7, block: "p", group_type: "nobleGas" }
];

// Color mapping for element groups
const GROUP_COLORS = {
  nonmetal: "#4CAF50",
  nobleGas: "#9C27B0",
  alkali: "#F44336",
  alkalineEarth: "#FF9800",
  metalloid: "#795548",
  halogen: "#00BCD4",
  transition: "#607D8B",
  metal: "#3F51B5",
  lanthanide: "#E91E63",
  actinide: "#9E9E9E"
};

// German group labels
const GROUP_LABELS = {
  nonmetal: "Nichtmetalle",
  nobleGas: "Edelgase",
  alkali: "Alkalimetalle",
  alkalineEarth: "Erdalkalimetalle",
  metalloid: "Halbmetalle",
  halogen: "Halogene",
  transition: "Übergangsmetalle",
  metal: "Metalle",
  lanthanide: "Lanthanoide",
  actinide: "Actinoide"
};

function ElementCell({ element, selected, onClick }) {
  const color = GROUP_COLORS[element.group_type] || "#999";
  return (
    <button
      className={`${styles.cell} ${selected ? styles.selected : ""}`}
      style={{ borderColor: selected ? color : "transparent" }}
      onClick={() => onClick(element)}
      title={`${element.name} (${element.symbol})`}
      aria-pressed={selected}
      aria-label={`${element.name} (${element.symbol}), ${GROUP_LABELS[element.group_type] || ""}`}
      data-testid={`element-cell-${element.symbol}`}
    >
      <span className={styles.number}>{element.number}</span>
      <span className={styles.symbol}>{element.symbol}</span>
      <span className={styles.elementName}>{element.name}</span>
    </button>
  );
}

ElementCell.propTypes = {
  element: PropTypes.shape({
    symbol: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    number: PropTypes.number.isRequired,
    group: PropTypes.number.isRequired,
    period: PropTypes.number.isRequired,
    block: PropTypes.string,
    group_type: PropTypes.string.isRequired
  }).isRequired,
  selected: PropTypes.bool,
  onClick: PropTypes.func.isRequired
};

function Legend() {
  return (
    <div className={styles.legend}>
      {Object.entries(GROUP_LABELS).map(([key, label]) => (
        <span key={key} className={styles.legendItem}>
          <span className={styles.legendDot} style={{ backgroundColor: GROUP_COLORS[key] }} />
          {label}
        </span>
      ))}
    </div>
  );
}

export default function ElementSelector({ onSelect, onClose }) {
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const selectedEl = ELEMENTS.find(el => el.symbol === selectedSymbol);

  // La–Lu (57-71) and Ac–Lr (89-103) sit below the main table
  const mainElements = ELEMENTS.filter(
    el => !(el.number >= 57 && el.number <= 71) && !(el.number >= 89 && el.number <= 103)
  );
  const lanthanides = ELEMENTS.filter(el => el.number >= 57 && el.number <= 71);
  const actinides = ELEMENTS.filter(el => el.number >= 89 && el.number <= 103);

  const handleCellClick = useCallback(
    element => {
      setSelectedSymbol(element.symbol);
      if (onSelect) onSelect(element);
    },
    [onSelect]
  );

  const handleConfirm = useCallback(() => {
    if (selectedEl) {
      onClose(selectedEl.symbol);
    }
  }, [selectedEl, onClose]);

  const handleCancel = useCallback(() => {
    onClose(null);
  }, [onClose]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>
          <FormattedMessage id="element-selector.title" defaultMessage="Periodensystem der Elemente" />
        </h2>
        <p className={styles.subtitle}>
          <FormattedMessage id="element-selector.subtitle" defaultMessage="Wähle ein Element für deinen Chemieraum" />
        </p>
      </div>

      <Legend />

      {/* Main PSE Grid */}
      <div className={styles.grid}>
        {mainElements.map(el => {
          const col = el.group;
          const row = el.period;
          return (
            <div key={el.symbol} style={{ gridRow: row, gridColumn: col, display: "flex" }}>
              <ElementCell element={el} selected={el.symbol === selectedSymbol} onClick={handleCellClick} />
            </div>
          );
        })}
      </div>

      {/* Lanthanides + Actinides row */}
      <div className={styles.fblockGrid}>
        <span className={styles.fblockLabel}>
          <FormattedMessage id="element-selector.lanthanides" defaultMessage="Lanthanoide" />
        </span>
        <div className={styles.fblockRow}>
          {lanthanides.map(el => (
            <ElementCell
              key={el.symbol}
              element={el}
              selected={el.symbol === selectedSymbol}
              onClick={handleCellClick}
            />
          ))}
        </div>
        <span className={styles.fblockLabel}>
          <FormattedMessage id="element-selector.actinides" defaultMessage="Actinoide" />
        </span>
        <div className={styles.fblockRow}>
          {actinides.map(el => (
            <ElementCell
              key={el.symbol}
              element={el}
              selected={el.symbol === selectedSymbol}
              onClick={handleCellClick}
            />
          ))}
        </div>
      </div>

      {/* Selected element info + confirm */}
      {selectedEl && (
        <div className={styles.infoCard}>
          <div className={styles.infoSymbol} style={{ color: GROUP_COLORS[selectedEl.group_type] }}>
            {selectedEl.symbol}
          </div>
          <div className={styles.infoDetails}>
            <h3>{selectedEl.name}</h3>
            <p>
              <FormattedMessage
                id="element-selector.atomic-info"
                defaultMessage="Ordnungszahl {number}, Gruppe {group}, Periode {period}"
                values={{
                  number: selectedEl.number,
                  group: selectedEl.group,
                  period: selectedEl.period
                }}
              />
            </p>
          </div>
          <button className={styles.confirmBtn} onClick={handleConfirm} data-testid="element-confirm-btn">
            <FormattedMessage
              id="element-selector.create-room"
              defaultMessage="Raum mit {name} erstellen"
              values={{ name: selectedEl.name }}
            />
          </button>
        </div>
      )}

      {/* Close without selection */}
      <button className={styles.cancelBtn} onClick={handleCancel} data-testid="element-cancel-btn">
        <FormattedMessage id="element-selector.cancel" defaultMessage="Abbrechen" />
      </button>
    </div>
  );
}

ElementSelector.propTypes = {
  onSelect: PropTypes.func,
  onClose: PropTypes.func.isRequired
};
