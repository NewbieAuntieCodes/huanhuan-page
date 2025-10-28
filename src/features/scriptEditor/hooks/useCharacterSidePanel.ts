
import { useState, useCallback, useEffect } from 'react';
import { Character } from '../../../types';

export const useCharacterSidePanel = (characters: Character[]) => {
  const [characterForSidePanel, setCharacterForSidePanel] = useState<Character | null>(null);

  const handleOpenCharacterSidePanel = useCallback((character: Character) => {
    const freshCharacter = characters.find(c => c.id === character.id) || character;
    setCharacterForSidePanel(freshCharacter);
  }, [characters]);

  const handleCloseCharacterSidePanel = useCallback(() => {
    setCharacterForSidePanel(null);
  }, []);

  useEffect(() => {
    if (characterForSidePanel) {
      const updatedCharacter = characters.find(c => c.id === characterForSidePanel.id);
      if (updatedCharacter) {
        setCharacterForSidePanel(updatedCharacter);
      } else {
        setCharacterForSidePanel(null);
      }
    }
  }, [characters, characterForSidePanel]);


  return {
    characterForSidePanel,
    setCharacterForSidePanel,
    handleOpenCharacterSidePanel,
    handleCloseCharacterSidePanel,
  };
};
