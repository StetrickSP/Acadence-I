export abstract class Person {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly email: string,
  ) {}

  abstract getRole(): string;
}
