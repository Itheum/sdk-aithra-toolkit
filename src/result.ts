export class Result<T, E extends Error = Error> {  
    #ok: T | null; // value  
    #err: E | null; // error
   
    private constructor(ok: T | null, err: E | null) {  
        this.#ok = ok;
        this.#err = err;
    }

    // For cases with no data (similar to Rust's Ok(()))
    static ok<E extends Error = Error>(): Result<void, E>;
    // For cases with data
    static ok<T, E extends Error = Error>(value: T): Result<T, E>;
    static ok<T, E extends Error = Error>(value?: T): Result<T | void, E> {
        return new Result<T | void, E>(value ?? null, null);
    }

    static err<T, E extends Error>(error: E): Result<T, E> {
        return new Result<T, E>(null, error);
    }
   
    unwrap(): T {  
        if (this.isOk()) {  
            return this.#ok as T;  
        }  
        
        if (this.isErr()) {  
            throw this.#err as E;  
        }  
        
        throw new Error("Unknown error");  
    }  
    
    isOk(): boolean {  
        return this.#ok !== null;  
    } 
      
    isErr(): boolean {  
        return this.#err !== null;  
    }  
      
    getErr(): E | null {  
        return this.#err;  
    }  
}
