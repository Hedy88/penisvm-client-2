export enum ClientRank {
    RegularUser = 0,
    AdminUser = 1,
}

export default class User {
    username: string;
    rank: ClientRank;

    constructor(username: string, rank: ClientRank) {
        this.username = username;
        this.rank = rank;
    }
}