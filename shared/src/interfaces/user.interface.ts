export interface BaseUserInterface {
  id: number;
  email: string;
  username: string;
  hp: number;
  maxHp: number;
  isDead: boolean;
  level: number;
  exp: number;
  gold: number;
  weaponId: number | null;
  createdAt: string;
  password: string;
}

export type UserInterface = Omit<BaseUserInterface, 'password'>;

export type UserRegistrationPayload = Pick<BaseUserInterface, 'email' | 'username' | 'password'> & {
  weaponId?: number;
};